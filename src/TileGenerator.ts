import { randomInt } from 'ireg-lib/random';
import { glsl } from 'ireg-lib/utils';
import * as THREE from 'three';

export class TileGenerator {
  private subdivisionsX: number;
  private subdivisionsY: number;
  private sceneWidth: number;
  private sceneHeight: number;
  private tileMesh: THREE.InstancedMesh;

  constructor(
    subdivisionsX: number,
    subdivisionsY: number,
    sceneWidth: number,
    sceneHeight: number
  ) {
    this.subdivisionsX = subdivisionsX;
    this.subdivisionsY = subdivisionsY;
    this.sceneWidth = sceneWidth;
    this.sceneHeight = sceneHeight;

    this.tileMesh = this.createTileMesh(this.generateRandomCustomTiles());
  }

  private createTileMesh(
    customTiles: { x: number; y: number; width: number; height: number }[]
  ): THREE.InstancedMesh {
    const tileWidth = this.sceneWidth / this.subdivisionsX;
    const tileHeight = this.sceneHeight / this.subdivisionsY;

    const geometry = new THREE.PlaneGeometry(tileWidth, tileHeight);
    const material = new THREE.ShaderMaterial({
      vertexShader: glsl`
        varying vec3 vColor;
        varying vec2 vUv;
        varying vec2 vNucPos;
        varying float vInverted;

        attribute vec2 nucPos;
        attribute float inverted;

        void main() {

          vUv = uv;
          vColor = instanceColor;
          vNucPos = nucPos;
          vInverted = inverted;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: glsl`
        varying vec3 vColor;
        varying vec2 vUv;
        varying vec2 vNucPos;
        varying float vInverted;


        void main() {
            vec3 col = vec3(1.0); //vColor;
            vec2 uv = vUv; // Replace with actual resolution
            float vignette = smoothstep(0.8, 0.7, length(uv - 0.5));
            col *= vignette;
            
            float vignetteSize = 0.1;
            float power = 0.5;
            col -= smoothstep(0., 0.7, max(0., length(uv - vNucPos) - 0.2) * 0.9);
            col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.x), power);
            col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.x), power);
            col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.y), power);
            col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.y), power);
            if(vInverted > 0.5) {
              col = vec3(1.0) - col;
            }
            gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });

    const dummyColor = new THREE.Color(0xffffff);
    // Add an instanceColor attribute to the geometry
    const instanceColors = new Float32Array(
      this.subdivisionsX * this.subdivisionsY * 3
    );
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

    const nucPos = new Float32Array(
      this.subdivisionsX * this.subdivisionsY * 2
    );
    for (let i = 0; i < nucPos.length; i += 2) {
      nucPos[i] = Math.random();
      nucPos[i + 1] = Math.random();
    }
    geometry.setAttribute(
      'nucPos',
      new THREE.InstancedBufferAttribute(nucPos, 2)
    );

    const inverted = new Float32Array(
      this.subdivisionsX * this.subdivisionsY * 1
    );
    for (let i = 0; i < inverted.length; i += 1) {
      inverted[i] = Math.random();
    }
    geometry.setAttribute(
      'inverted',
      new THREE.InstancedBufferAttribute(inverted, 1)
    );

    const count = this.subdivisionsX * this.subdivisionsY;
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.setColorAt(0, dummyColor);

    let index = 0;
    const dummy = new THREE.Object3D();

    const occupied = Array.from({ length: this.subdivisionsX }, () =>
      Array(this.subdivisionsY).fill(false)
    );

    // Place custom tiles
    for (const tile of customTiles) {
      const tileX =
        tile.x * tileWidth - this.sceneWidth / 2 + (tile.width * tileWidth) / 2;
      const tileY =
        tile.y * tileHeight -
        this.sceneHeight / 2 +
        (tile.height * tileHeight) / 2;

      dummy.scale.set(tile.width, tile.height, 1);
      dummy.position.set(tileX, tileY, 0);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index++, dummy.matrix);

      //   dummyColor.setHSL(Math.random(), 1, 0.5);
      //   instancedMesh.setColorAt(index - 1, dummyColor);

      for (let i = tile.x; i < tile.x + tile.width; i++) {
        for (let j = tile.y; j < tile.y + tile.height; j++) {
          occupied[i][j] = true;
        }
      }
    }

    // Fill remaining tiles
    for (let i = 0; i < this.subdivisionsX; i++) {
      for (let j = 0; j < this.subdivisionsY; j++) {
        if (occupied[i][j]) continue;

        const x = -this.sceneWidth / 2 + tileWidth / 2 + i * tileWidth;
        const y = -this.sceneHeight / 2 + tileHeight / 2 + j * tileHeight;

        dummy.scale.set(1, 1, 1);
        dummy.position.set(x, y, 0);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(index++, dummy.matrix);

        // dummyColor.setHSL(Math.random(), 1, 0.5);
        // instancedMesh.setColorAt(index - 1, dummyColor);
      }
    }

    instancedMesh.count = index; // Update the count to match the number of tiles
    return instancedMesh;
  }

  private generateRandomCustomTiles(): {
    x: number;
    y: number;
    width: number;
    height: number;
  }[] {
    const customTiles: {
      x: number;
      y: number;
      width: number;
      height: number;
    }[] = [];
    const occupied = Array.from({ length: this.subdivisionsX }, () =>
      Array(this.subdivisionsY).fill(false)
    );

    const randomTileCount = 20; // Random number of custom tiles (1 to 5)

    for (let t = 0; t < randomTileCount; t++) {
      let width, height, x, y;
      let valid = false;

      while (!valid) {
        width = Math.floor(Math.random() * 3) + 2; // Random width (1 to 3)
        height = Math.floor(Math.random() * 3) + 2; // Random height (1 to 3)
        x = Math.floor(Math.random() * this.subdivisionsX);
        y = Math.floor(Math.random() * this.subdivisionsY);

        valid = true;

        // Check if the tile fits within the grid and doesn't overlap
        if (x + width > this.subdivisionsX || y + height > this.subdivisionsY) {
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

      customTiles.push({ x, y, width, height });
    }

    return customTiles;
  }

  public getTileMesh(
    customTiles: { x: number; y: number; width: number; height: number }[] = []
  ): THREE.InstancedMesh {
    if (customTiles.length === 0) {
      customTiles = this.generateRandomCustomTiles();
    }
    this.tileMesh = this.createTileMesh(customTiles);
    return this.tileMesh;
  }
}
