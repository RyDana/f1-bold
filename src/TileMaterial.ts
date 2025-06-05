import * as THREE from 'three';
import { glsl } from 'ireg-lib/utils';
import { createGradientTexture } from './utils';
import { Params } from './MainScene';
import { randomCandidate } from 'ireg-lib/random';

export class TileMaterial extends THREE.ShaderMaterial {
  constructor(parameters: Params) {
    super({
      vertexShader: glsl`
            varying vec3 vColor;
            varying vec2 vUv;
            varying vec2 vNucPos;
            varying float vDirection;
    
            attribute vec2 nucPos;
            attribute float direction;
    
            void main() {
    
              vUv = uv;
              vColor = instanceColor;
              vNucPos = nucPos;
              vDirection = direction;
              gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
          `,
      fragmentShader: glsl`
            varying vec3 vColor;
            varying vec2 vUv;
            varying vec2 vNucPos;
            varying float vDirection;
    
            uniform float uTime;
            uniform sampler2D uGradientTexture;
            uniform float uGradientDivisions;
            uniform float uVignetteSize;
            uniform float uSpeed;
            uniform float uAsyncPos;
            uniform float uAsyncSpeed;
    
    
            void main() {
                vec3 col = vec3(1.0); //vColor;
                vec2 uv = vUv; // Replace with actual resolution
                float vignette = smoothstep(0.8, 0.7, length(uv - 0.5));
                col *= vignette;
                
                float vignetteSize = uVignetteSize;
                float power = 0.5;
                // col -= smoothstep(0., 0.7, max(0., length(uv - vec2(sin(uTime * vNucPos.x) * 0.5 + 0.5, sin(uTime * vNucPos.y) * 0.5 + 0.5)) - 0.2) * 0.9);
                
                float time = uTime * uSpeed * (1. + (vNucPos.y * uAsyncSpeed)) + vNucPos.x * uAsyncPos; //sin(uTime * 0.05 + vNucPos.x) * 10.0;
                float xDir = uv.x * step(0.75, vDirection) + (1.0 - uv.x) * (1.0 - step(0.75, vDirection));
                float yDir = uv.y * step(0.25, vDirection) + (1.0 - uv.y) * (1.0 - step(0.25, vDirection));
                float xMod = (mod(xDir * uGradientDivisions + time, 1.0)) * step(0.5, vDirection);
                float yMod = (mod(yDir * uGradientDivisions + time, 1.0)) * (1.0 - step(0.5, vDirection));
                col -= (xMod + yMod); //sin((xMod + yMod) * 3.14159 ) * 0.5 + 0.5;

                col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.x), power);
                col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.x), power);
                col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.y), power);
                col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.y), power);

                vec3 gradientColor = texture(uGradientTexture, vec2(col.r, 0.5)).rgb;
                col = gradientColor; 
    
                gl_FragColor = vec4(vec3(uv.x) * step(0.5, uv.y) + vec3(xMod) * (1.0 - step(0.5, uv.y)), 1.0);
                gl_FragColor = vec4(col, 1.0);

            }
          `,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uGradientTexture: {
          value: createGradientTexture(parameters.uGradientTexture),
        },
        uGradientDivisions: { value: parameters.uGradientDivisions },
        uVignetteSize: { value: parameters.uVignetteSize },
        uSpeed: { value: parameters.uSpeed },
        uAsyncPos: { value: parameters.uAsyncPos },
        uAsyncSpeed: { value: parameters.uAsyncSpeed },
      },
    });
  }

  public update() {
    this.uniforms.uTime.value = (Date.now() / 1000) % 1000;
    this.needsUpdate = true;
  }

  public setGradient(
    GradientStops: {
      time: number;
      value: { r: number; g: number; b: number; a: number };
    }[]
  ) {
    this.uniforms.uGradientTexture.value = createGradientTexture(GradientStops);
    this.needsUpdate = true;
  }

  public setGradientDivisions(divisions: number) {
    this.uniforms.uGradientDivisions.value = divisions;
    this.needsUpdate = true;
  }

  public setVignetteSize(size: number) {
    this.uniforms.uVignetteSize.value = size;
    this.needsUpdate = true;
  }

  public setSpeed(speed: number) {
    this.uniforms.uSpeed.value = speed;
    this.needsUpdate = true;
  }
  public setAsyncPos(async: number) {
    this.uniforms.uAsyncPos.value = async;
    this.needsUpdate = true;
  }
  public setAsyncSpeed(async: number) {
    this.uniforms.uAsyncSpeed.value = async;
    this.needsUpdate = true;
  }
}
