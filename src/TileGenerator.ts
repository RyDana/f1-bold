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

enum DivisionTypes {
  NONE,
  CONCENTRIC,
  UNEQUAL_THIRDS,
  UNEQUAL_HALVES,
  REGULAR,
}

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
    let divisionProbabilities: [number, DivisionTypes][] = [
      [this.parameters.probTileNone * 10, DivisionTypes.NONE],
      [this.parameters.probTileConcentric * 10, DivisionTypes.CONCENTRIC],
      [
        this.parameters.probTileUnequalThirds * 10,
        DivisionTypes.UNEQUAL_THIRDS,
      ],
      [
        this.parameters.probTileUnequalHalves * 10,
        DivisionTypes.UNEQUAL_HALVES,
      ],
      [this.parameters.probTileEven * 10, DivisionTypes.REGULAR],
    ];

    divisionProbabilities = divisionProbabilities.filter(
      ([probability]) => probability > 0.00001
    );

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
      const newTiles: Tile[] = [];

      for (let j = 0; j < tiles.length; j++) {
        const tile = tiles[j];

        // if the tile is not at the current level, skip it
        if (tile.level !== i - 1) {
          newTiles.push(tile);
          continue;
        }

        let allowedDivisionTypes: [number, DivisionTypes][] =
          i > interactionRange.min
            ? divisionProbabilities
            : divisionProbabilities.filter(([, type]) => {
                return (
                  type !== DivisionTypes.NONE &&
                  type !== DivisionTypes.CONCENTRIC
                );
              });

        let divisionType =
          allowedDivisionTypes.length > 0
            ? randomCandidate(allowedDivisionTypes)[1]
            : DivisionTypes.REGULAR;

        if (divisionType === DivisionTypes.NONE) {
          newTiles.push(tile);
          continue;
        }

        if (divisionType === DivisionTypes.CONCENTRIC) {
          const concentric = this.concentricTile(tile);
          if (concentric !== null) {
            newTiles.push(...concentric);
            continue;
          } else {
            allowedDivisionTypes = allowedDivisionTypes.filter(
              ([, type]) => type !== DivisionTypes.CONCENTRIC
            );
            divisionType = randomCandidate(allowedDivisionTypes)[1];
          }
        }

        //chose how many divisions
        const divisions = randomInt(divisionRange.min, divisionRange.max + 1);

        if (i <= 2) {
          if (divisions === 2) {
            allowedDivisionTypes = allowedDivisionTypes.filter(
              ([, type]) => type !== DivisionTypes.UNEQUAL_THIRDS
            );
          }
          if (divisions === 3) {
            allowedDivisionTypes = allowedDivisionTypes.filter(
              ([, type]) => type !== DivisionTypes.UNEQUAL_HALVES
            );
          }
        } else {
          allowedDivisionTypes = allowedDivisionTypes.filter(
            ([, type]) =>
              type !== DivisionTypes.UNEQUAL_THIRDS &&
              type !== DivisionTypes.UNEQUAL_HALVES
          );
        }

        divisionType =
          allowedDivisionTypes.length > 0
            ? randomCandidate(allowedDivisionTypes)[1]
            : DivisionTypes.REGULAR;

        if (divisionType === DivisionTypes.UNEQUAL_THIRDS) {
          const thirds = this.unevenThirdsTile(tile, i);
          if (thirds !== null) {
            newTiles.push(...thirds);
            continue;
          }
        }

        if (divisionType === DivisionTypes.UNEQUAL_HALVES) {
          const halves = this.unevenHalvesTile(tile, i);
          if (halves !== null) {
            newTiles.push(...halves);
            continue;
          }
        }

        if (divisionType === DivisionTypes.REGULAR) {
          const regular = this.regularSplitTile(tile, i, divisions);
          if (regular !== null) {
            newTiles.push(...regular);
            continue;
          }
        }

        newTiles.push(tile);
      }
      tiles = newTiles;
    }

    return tiles;
  }

  private regularSplitTile(
    tile: Tile,
    level: number,
    divisions: number
  ): Tile[] | null {
    const newTiles: Tile[] = [];

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
      return null;
    }

    tile[direction] = newTileDim;
    tile.level = level;
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
        level: level,
        x: tile.x + (direction === 'width' ? newTileDim * k : 0),
        y: tile.y + (direction === 'height' ? newTileDim * k : 0),
        width,
        height,
      };
      newTiles.push(newTile);
    }
    return newTiles;
  }

  private unevenHalvesTile(tile: Tile, level: number): Tile[] | null {
    const newTiles: Tile[] = [];
    const direction = tile.width > tile.height ? 'width' : 'height';
    const sectionDim = tile[direction] / 3;
    const newTileDims = shuffleArray([sectionDim, sectionDim * 2]);

    let newX = tile.x;
    let newY = tile.y;

    let dir = tile.direction;

    for (let k = 0; k < newTileDims.length; k++) {
      const width = direction === 'width' ? newTileDims[k] : tile.width;
      const height = direction === 'height' ? newTileDims[k] : tile.height;
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
        dir = randomCandidate([GradientDirection.DOWN, GradientDirection.UP]);
      }

      const newTile: Tile = {
        direction: dir,
        level,
        x: newX,
        y: newY,
        width,
        height,
      };
      newX += direction === 'width' ? newTileDims[k] : 0;
      newY += direction === 'height' ? newTileDims[k] : 0;
      newTiles.push(newTile);
    }
    return newTiles;
  }

  private unevenThirdsTile(tile: Tile, level: number): Tile[] | null {
    const newTiles: Tile[] = [];
    const direction = tile.width > tile.height ? 'width' : 'height';
    const sectionDim = tile[direction] / 4;
    const newTileDims = [sectionDim, sectionDim * 2, sectionDim];

    let newX = tile.x;
    let newY = tile.y;
    const dir =
      tile.width > tile.height
        ? randomCandidate([GradientDirection.RIGHT, GradientDirection.LEFT])
        : randomCandidate([GradientDirection.DOWN, GradientDirection.UP]);

    for (let k = 0; k < newTileDims.length; k++) {
      const width = direction === 'width' ? newTileDims[k] : tile.width;
      const height = direction === 'height' ? newTileDims[k] : tile.height;

      const newTile: Tile = {
        direction: dir,
        level,
        x: newX,
        y: newY,
        width,
        height,
      };
      newX += direction === 'width' ? newTileDims[k] : 0;
      newY += direction === 'height' ? newTileDims[k] : 0;
      newTiles.push(newTile);
    }

    return newTiles;
  }

  private concentricTile(tile: Tile): Tile[] | null {
    const tiles: Tile[] = [];
    tiles.push(tile);

    //Try how many concentric tiles could fit
    let step = this.sceneDimensions.x * this.parameters.thinnestTileSize;
    let divisions = Math.min(tile.height, tile.width) / step / 2;
    if (divisions > this.parameters.concentricRange.max) {
      divisions = this.parameters.concentricRange.max;
    }
    // for (
    //   let i = this.parameters.concentricRange.max;
    //   i >= this.parameters.concentricRange.min;
    //   i--
    // ) {
    //   step = Math.min(tile.height, tile.width) / 2 / i;
    //   if (step >= this.sceneDimensions.x * this.parameters.thinnestTileSize) {
    //     divisions = i;
    //     break;
    //   }
    // }
    if (divisions === 0) return null;

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
