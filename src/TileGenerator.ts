import { chance, randomCandidate, randomInt } from 'ireg-lib/random';
import { glsl } from 'ireg-lib/utils';
import * as THREE from 'three';
import { createGradientTexture } from './utils';
import { TileMaterial } from './TileMaterial';
import { Params } from './MainScene';

enum GradientDirection {
  DOWN = 0.25,
  UP = 0.0,
  LEFT = 0.75,
  RIGHT = 0.5,
}

export type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  direction: GradientDirection;
};

export type TileMesh = THREE.InstancedMesh<THREE.PlaneGeometry, TileMaterial>;

export class TileGenerator {
  private tileMesh: TileMesh;
  private parameters: Params;

  constructor(private sceneDimensions: THREE.Vector2, parameters: Params) {
    this.parameters = parameters;
    this.tileMesh = this.getTileMesh(parameters);
  }

  public getTileMesh(parameters: Params, customTiles: Tile[] = []): TileMesh {
    this.tileMesh?.geometry.dispose();
    this.tileMesh?.material.dispose();
    if (customTiles.length === 0) {
      customTiles = this.generateQuadtreeTiles(
        this.parameters.iterationRange,
        this.parameters.divisionRange,
        this.parameters.concentricRange
      );
    }
    this.tileMesh = this.createTileMesh(customTiles, parameters);
    return this.tileMesh;
  }

  private createTileMesh(
    tiles: Tile[],
    parameters: Params
  ): THREE.InstancedMesh<THREE.PlaneGeometry, TileMaterial> {
    const tileCount = tiles.length;

    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new TileMaterial(parameters);

    const dummyColor = new THREE.Color(0xffffff);
    const instanceColors = new Float32Array(tileCount * 3);
    for (let i = 0; i < instanceColors.length; i += 3) {
      dummyColor.setHSL(Math.random(), 1, 0.5);
      instanceColors[i] = dummyColor.r;
      instanceColors[i + 1] = dummyColor.g;
      instanceColors[i + 2] = dummyColor.b;
    }
    geometry.setAttribute(
      'instanceColor',
      new THREE.InstancedBufferAttribute(instanceColors, 3)
    );

    const nucPos = new Float32Array(tileCount * 2);
    for (let i = 0; i < nucPos.length; i += 2) {
      nucPos[i] = Math.random();
      nucPos[i + 1] = Math.random();
    }
    geometry.setAttribute(
      'nucPos',
      new THREE.InstancedBufferAttribute(nucPos, 2)
    );

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      tileCount
    );
    instancedMesh.setColorAt(0, dummyColor);

    const direction = new Float32Array(tileCount);
    let index = 0;
    const dummy = new THREE.Object3D();
    for (const tile of tiles) {
      const tileWidth = tile.width;
      const tileHeight = tile.height;

      direction[index] = tile.direction;

      const tileX = tile.x - this.sceneDimensions.x / 2 + tileWidth / 2;
      const tileY = tile.y - this.sceneDimensions.y / 2 + tileHeight / 2;

      dummy.scale.set(tileWidth, tileHeight, 1);
      dummy.position.set(tileX, tileY, 0);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index++, dummy.matrix);
    }

    geometry.setAttribute(
      'direction',
      new THREE.InstancedBufferAttribute(direction, 1)
    );

    return instancedMesh;
  }

  private generateQuadtreeTiles(
    interactionRange: { min: number; max: number },
    divisionRange: { min: number; max: number },
    concentricRange: { min: number; max: number }
  ): Tile[] {
    let tiles: Tile[] = [
      {
        direction: GradientDirection.UP,
        level: 0,
        x: 0,
        y: 0,
        width: this.sceneDimensions.x,
        height: this.sceneDimensions.y,
      },
    ];

    for (let i = 1; i <= interactionRange.max; i++) {
      //split the tile vertically or horizontally
      const newTiles: Tile[] = [];
      for (let j = 0; j < tiles.length; j++) {
        const tile = tiles[j];
        if (tile.level !== i - 1) {
          newTiles.push(tile);
          continue;
        }

        if (chance(0.2) && i > interactionRange.min) {
          newTiles.push(
            ...this.concentricTile(
              tile,
              randomInt(concentricRange.min, concentricRange.max)
            )
          );
          // newTiles.push(tile);
          continue;
        }

        //choose direction to split
        const direction = chance(0.5) ? 'width' : 'height';
        //chose how many divisions
        const divisions = randomInt(divisionRange.min, divisionRange.max);

        //create new tile
        const newTileDim = tile[direction] / divisions;
        tile[direction] = newTileDim;
        tile.level = i;
        for (let k = 0; k < divisions; k++) {
          const width = direction === 'width' ? newTileDim : tile.width;
          const height = direction === 'height' ? newTileDim : tile.height;
          const dir =
            width > height
              ? randomCandidate([
                  GradientDirection.RIGHT,
                  GradientDirection.LEFT,
                ])
              : randomCandidate([GradientDirection.DOWN, GradientDirection.UP]);

          const newTile: Tile = {
            direction: dir,
            level: i,
            x: tile.x + (direction === 'width' ? newTileDim * k : 0),
            y: tile.y + (direction === 'height' ? newTileDim * k : 0),
            width,
            height,
          };
          newTiles.push(newTile);
        }
      }
      tiles = newTiles;
    }

    return tiles;
  }

  private concentricTile(tile: Tile, number: number): Tile[] {
    const tiles: Tile[] = [];
    tiles.push(tile);
    const step = tile.width / 2 / (number + 1);
    for (let i = 0; i < number; i++) {
      const offset = step * (i + 1);
      const width = tile.width - offset * 2;
      const height = tile.height - offset * 2;
      const direction =
        width > height
          ? randomCandidate([GradientDirection.RIGHT, GradientDirection.LEFT])
          : randomCandidate([GradientDirection.DOWN, GradientDirection.UP]);
      tiles.push({
        direction,
        level: tile.level,
        x: tile.x + offset,
        y: tile.y + offset,
        width,
        height,
      });
    }
    return tiles;
  }

  public update(): void {
    this.tileMesh.material.update();
  }
}
