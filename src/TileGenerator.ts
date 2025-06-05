import {
  chance,
  randomCandidate,
  randomInt,
  shuffleArray,
} from 'ireg-lib/random';
import { glsl } from 'ireg-lib/utils';
import * as THREE from 'three';
import { createGradientTexture } from './utils';
import { TileMaterial } from './TileMaterial';
import { Params } from './MainScene';
import { clamp } from 'ireg-lib/math';

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

        if (
          chance(this.parameters.skipDivisionChance) &&
          i > interactionRange.min
        ) {
          newTiles.push(tile);
          continue;
        }

        if (
          chance(this.parameters.concentricChance) &&
          i > interactionRange.min
        ) {
          const concentric = this.concentricTile(
            tile,
            randomInt(concentricRange.min, concentricRange.max + 1)
          );
          if (concentric !== null) {
            newTiles.push(...concentric);
            continue;
          }
        }

        //chose how many divisions
        const divisions = randomInt(divisionRange.min, divisionRange.max + 1);

        if (
          chance(this.parameters.unequalThirdsChance) &&
          divisions === 3 &&
          i <= 2
        ) {
          //choose direction to split
          const direction = tile.width > tile.height ? 'width' : 'height';
          const sectionDim = tile[direction] / 4;
          const newTileDims = [sectionDim, sectionDim * 2, sectionDim];

          let newX = tile.x;
          let newY = tile.y;
          const dir =
            tile.width > tile.height
              ? randomCandidate([
                  GradientDirection.RIGHT,
                  GradientDirection.LEFT,
                ])
              : randomCandidate([GradientDirection.DOWN, GradientDirection.UP]);

          for (let k = 0; k < newTileDims.length; k++) {
            const width = direction === 'width' ? newTileDims[k] : tile.width;
            const height =
              direction === 'height' ? newTileDims[k] : tile.height;

            const newTile: Tile = {
              direction: dir,
              level: i,
              x: newX,
              y: newY,
              width,
              height,
            };
            newX += direction === 'width' ? newTileDims[k] : 0;
            newY += direction === 'height' ? newTileDims[k] : 0;
            newTiles.push(newTile);
          }
          continue;
        }

        if (
          chance(this.parameters.unequalHalvesChance) &&
          divisions === 2 &&
          i <= 2
        ) {
          //choose direction to split
          const direction = tile.width > tile.height ? 'width' : 'height';
          const sectionDim = tile[direction] / 3;
          const newTileDims = shuffleArray([sectionDim, sectionDim * 2]);

          let newX = tile.x;
          let newY = tile.y;

          let dir = tile.direction;

          for (let k = 0; k < newTileDims.length; k++) {
            const width = direction === 'width' ? newTileDims[k] : tile.width;
            const height =
              direction === 'height' ? newTileDims[k] : tile.height;
            if (
              width > height &&
              [GradientDirection.UP, GradientDirection.DOWN].includes(dir)
            ) {
              dir = randomCandidate([
                GradientDirection.RIGHT,
                GradientDirection.LEFT,
              ]);
            } else if (
              height > width &&
              [GradientDirection.LEFT, GradientDirection.RIGHT].includes(dir)
            ) {
              dir = randomCandidate([
                GradientDirection.DOWN,
                GradientDirection.UP,
              ]);
            }

            const newTile: Tile = {
              direction: dir,
              level: i,
              x: newX,
              y: newY,
              width,
              height,
            };
            newX += direction === 'width' ? newTileDims[k] : 0;
            newY += direction === 'height' ? newTileDims[k] : 0;
            newTiles.push(newTile);
          }
          continue;
        }

        //choose direction to split
        let direction: 'width' | 'height' = chance(0.5) ? 'width' : 'height';

        //create new tile
        let newTileDim = tile[direction] / divisions;
        if (
          newTileDim <
          this.sceneDimensions.x * this.parameters.thinnestTileSize
        ) {
          direction = direction === 'width' ? 'height' : 'width';
          newTileDim = tile[direction] / divisions;
        }

        if (
          newTileDim <
          this.sceneDimensions.x * this.parameters.thinnestTileSize
        ) {
          newTiles.push(tile);
          continue;
        }

        tile[direction] = newTileDim;
        tile.level = i;
        const genDir = randomCandidate([
          GradientDirection.DOWN,
          GradientDirection.UP,
        ]);
        for (let k = 0; k < divisions; k++) {
          const width = direction === 'width' ? newTileDim : tile.width;
          const height = direction === 'height' ? newTileDim : tile.height;
          const dir =
            width > height
              ? [GradientDirection.RIGHT, GradientDirection.LEFT][k % 2]
              : direction === 'height'
              ? genDir
              : [GradientDirection.DOWN, GradientDirection.UP][k % 2];

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

  private concentricTile(tile: Tile, number: number): Tile[] | null {
    const tiles: Tile[] = [];
    tiles.push(tile);

    //Try how many concentric tiles could fit
    let step = 0;
    let divisions = 0;
    for (
      let i = this.parameters.concentricRange.max;
      i >= this.parameters.concentricRange.min;
      i--
    ) {
      step = Math.min(tile.height, tile.width) / 2 / i;
      if (step >= this.sceneDimensions.x * this.parameters.thinnestTileSize) {
        divisions = i;
        break;
      }
    }
    if (divisions === 0) {
      return null;
    }

    // const step =
    //   (tile.width > tile.height ? tile.height : tile.width) / 2 / (number + 1);
    // if (step < this.sceneDimensions.x * this.parameters.thinnestTileSize)
    //   return null;

    const dirFactoryGenerator = randomCandidate([
      (dirs: GradientDirection[]) => (index: number) =>
        dirs[index % dirs.length],
      (dirs: GradientDirection[]) => {
        const dir = randomCandidate(dirs);
        return (index: number) => dir;
      },
    ]);

    const dirFactory =
      tile.width > tile.height
        ? dirFactoryGenerator([GradientDirection.RIGHT, GradientDirection.LEFT])
        : dirFactoryGenerator([GradientDirection.DOWN, GradientDirection.UP]);
    tile.direction = dirFactory(1);

    for (let i = 0; i < divisions; i++) {
      const offset = step * (i + 1);
      const width = clamp(tile.width - offset * 2, 0, this.sceneDimensions.x);
      const height = clamp(tile.height - offset * 2, 0, this.sceneDimensions.y);
      const direction = dirFactory(i);

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
