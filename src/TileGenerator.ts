import { chance, randomCandidate, randomInt } from 'ireg-lib/random';
import { glsl } from 'ireg-lib/utils';
import * as THREE from 'three';
import { createGradientTexture } from './utils';
import { TileMaterial } from './TileMaterial';
import { Params } from './MainScene';

export type Tile = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TileMesh = THREE.InstancedMesh<
  THREE.PlaneGeometry,
  THREE.ShaderMaterial
>;

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
      // customTiles = this.generateRandomCustomTiles(
      //   8,
      //   (8 * this.sceneDimensions.y) / this.sceneDimensions.x
      // );

      customTiles = this.generateQuadtreeTiles(
        this.parameters.iterationRange,
        this.parameters.divisionRange
      );
    }
    this.tileMesh = this.createTileMesh(customTiles, parameters);
    return this.tileMesh;
  }

  private createTileMesh(
    tiles: Tile[],
    parameters: Params
  ): THREE.InstancedMesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
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

    const inverted = new Float32Array(tileCount);
    for (let i = 0; i < inverted.length; i += 1) {
      inverted[i] = Math.random();
    }
    geometry.setAttribute(
      'inverted',
      new THREE.InstancedBufferAttribute(inverted, 1)
    );

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      tileCount
    );
    instancedMesh.setColorAt(0, dummyColor);

    let index = 0;
    const dummy = new THREE.Object3D();
    for (const tile of tiles) {
      const tileWidth = tile.width * this.sceneDimensions.x;
      const tileHeight = tile.height * this.sceneDimensions.y;

      const tileX =
        tile.x * this.sceneDimensions.x -
        this.sceneDimensions.x / 2 +
        tileWidth / 2;
      const tileY =
        tile.y * this.sceneDimensions.y -
        this.sceneDimensions.y / 2 +
        tileHeight / 2;

      dummy.scale.set(tileWidth, tileHeight, 1);
      dummy.position.set(tileX, tileY, 0);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index++, dummy.matrix);
    }
    return instancedMesh;
  }

  private generateRandomCustomTiles(
    subdivisionsX: number,
    subdivisionsY: number
  ): Tile[] {
    const customTiles: Tile[] = [];
    const tileWidth = 1 / subdivisionsX; // Width of each tile
    const tileHeight = 1 / subdivisionsY; // Height of each tile
    const occupied = Array.from({ length: subdivisionsX }, () =>
      Array(subdivisionsY).fill(false)
    );

    const randomTileCount = 5; // Random number of custom tiles (1 to 5)

    for (let t = 0; t < randomTileCount; t++) {
      let width = 0,
        height = 0,
        x = 0,
        y = 0;
      let valid = false;

      while (!valid) {
        width = randomCandidate([1, 5]);
        height = 6 - width;
        x = randomInt(0, subdivisionsX);
        y = randomInt(0, subdivisionsY);

        valid = true;

        // Check if the tile fits within the grid and doesn't overlap
        if (x + width > subdivisionsX || y + height > subdivisionsY) {
          valid = false;
          continue;
        }

        for (let i = x; i < x + width; i++) {
          for (let j = y; j < y + height; j++) {
            if (occupied[i][j]) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
      }

      // Mark the area as occupied
      for (let i = x; i < x + width; i++) {
        for (let j = y; j < y + height; j++) {
          occupied[i][j] = true;
        }
      }

      customTiles.push({
        x: x * tileWidth,
        y: y * tileHeight,
        width: width / subdivisionsX,
        height: height / subdivisionsY,
      });
    }

    // Fill remaining tiles
    for (let i = 0; i < subdivisionsX; i++) {
      for (let j = 0; j < subdivisionsY; j++) {
        if (occupied[i][j]) continue;
        const x = i / subdivisionsX;
        const y = j / subdivisionsY;
        customTiles.push({ x, y, width: tileWidth, height: tileHeight });
      }
    }

    return customTiles;
  }

  private generateQuadtreeTiles(
    interactionRange: { min: number; max: number },
    divisionRange: { min: number; max: number }
  ): Tile[] {
    type LevelledTile = Tile & {
      level: number;
    };
    let tiles: LevelledTile[] = [
      {
        level: 0,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    ];

    for (let i = 1; i <= interactionRange.max; i++) {
      //split the tile vertically or horizontally
      const newTiles: LevelledTile[] = [];
      for (let j = 0; j < tiles.length; j++) {
        const tile = tiles[j];
        if (tile.level !== i - 1) {
          newTiles.push(tile);
          continue;
        }

        if (chance(0.2) && i > interactionRange.min) {
          newTiles.push(tile);
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
          const newTile: LevelledTile = {
            level: i,
            x: tile.x + (direction === 'width' ? newTileDim * k : 0),
            y: tile.y + (direction === 'height' ? newTileDim * k : 0),
            width: direction === 'width' ? newTileDim : tile.width,
            height: direction === 'height' ? newTileDim : tile.height,
          };
          newTiles.push(newTile);
        }
      }
      tiles = newTiles;
    }

    return tiles;
  }

  public update(): void {
    this.tileMesh.material.uniforms.uTime.value = (Date.now() / 100) % 1000;
    this.tileMesh.material.needsUpdate = true;
  }
}
