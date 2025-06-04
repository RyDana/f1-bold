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
    
            uniform float uTime;
            uniform sampler2D uGradientTexture;
            uniform float uGradientDivisions;
    
    
            void main() {
                vec3 col = vec3(1.0); //vColor;
                vec2 uv = vUv; // Replace with actual resolution
                float vignette = smoothstep(0.8, 0.7, length(uv - 0.5));
                col *= vignette;
                
                float vignetteSize = 0.0;
                float power = 0.5;
                // col -= smoothstep(0., 0.7, max(0., length(uv - vec2(sin(uTime * vNucPos.x) * 0.5 + 0.5, sin(uTime * vNucPos.y) * 0.5 + 0.5)) - 0.2) * 0.9);
                
                float time = sin(uTime * 0.05 + vNucPos.x) * 10.0;
                float xDir = uv.x * step(0.75, vInverted) + (1.0 - uv.x) * (1.0 - step(0.75, vInverted));
                float yDir = uv.y * step(0.25, vInverted) + (1.0 - uv.y) * (1.0 - step(0.25, vInverted));
                float xMod = (mod(xDir * uGradientDivisions + time * 0.4 /* * vNucPos.x*/ , 1.0) - 0.) * step(0.5, vInverted);
                float yMod = (mod(yDir * uGradientDivisions + time * 0.4 /* * vNucPos.y*/, 1.0) - 0.) * (1.0 - step(0.5, vInverted));
                col -= abs(sin((xMod + yMod))); //sin((xMod + yMod) * 3.14159 ) * 0.5 + 0.5;

                col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.x), power);
                col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.x), power);
                col *= pow(1.0 - smoothstep(vignetteSize, 0., uv.y), power);
                col *= pow(1.0 - smoothstep(1.0 - vignetteSize, 1.0, uv.y), power);
                // if(vInverted > 0.5) {
                //   col = vec3(1.0) - col;
                // }
    
                vec3 gradientColor = texture(uGradientTexture, vec2(col.r, 0.5)).rgb;
                col = gradientColor; 
    
                gl_FragColor = vec4(col, 1.0);
            }
          `,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uGradientTexture: {
          value: createGradientTexture(parameters.uGradientTexture),
        },
        uGradientDivisions: { value: parameters.uGradientDivisions }, //randomCandidate([0.1, 0.5, 1, 2, 3]) },
      },
    });
  }

  public update(time: number) {
    this.uniforms.uTime.value = time;
  }

  public setGradient(
    GradientStops: {
      time: number;
      value: { r: number; g: number; b: number; a: number };
    }[]
  ) {
    this.uniforms.uGradientTexture.value = createGradientTexture(GradientStops);
  }

  public setGradientDivisions(divisions: number) {
    this.uniforms.uGradientDivisions.value = divisions;
  }
}
