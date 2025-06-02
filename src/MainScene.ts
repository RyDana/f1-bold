// import { ContentApplication, UserID, Blob, sonar, Point2D } from 'cursor-lib';
import * as THREE from 'three';
// import SoundController, { SoundEvent } from './SoundController';
import { autoSaveToLocalStorage, createGradientTexture } from './utils';
import { Pane } from 'tweakpane';
import {
  Gradient,
  GradientBladeApi,
  GradientPluginBundle,
  GradientBladeParams,
} from 'tweakpane-plugin-gradient';
import { TileGenerator } from './TileGenerator';

const defaultSettings = {};

export type MatUniforms = typeof defaultSettings;
export type RemappedMatUniforms = {
  [K in keyof MatUniforms]: { value: MatUniforms[K] };
};

const parameters = autoSaveToLocalStorage('parameters', {
  ...defaultSettings,
  ...JSON.parse(localStorage.getItem('parameters') ?? '{}'),
});

export default class MainScene {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private aspectRatio: number = 1;
  private mesh: RibbedGlass;
  private pane = new Pane();
  tileGenerator: TileGenerator;

  constructor(
    private dimensions: THREE.Vector2,
    private renderer: THREE.WebGLRenderer // private soundController: SoundController<SoundEvent>,
  ) {
    this.aspectRatio = dimensions.width / dimensions.height;
    this.camera = new THREE.OrthographicCamera(
      -0.5 * this.aspectRatio,
      0.5 * this.aspectRatio,
      0.5,
      -0.5,
      -10,
      10
    );
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000);

    //PANE
    this.pane.registerPlugin(GradientPluginBundle);
    this.pane.addButton({ title: 'Reset settings' }).on('click', () => {
      localStorage.removeItem('parameters');
      window.location = window.location;
      Object.assign(parameters, defaultSettings);
    });

    this.pane.addButton({ title: 'Export settings' }).on('click', () => {
      const exportedSettings = JSON.stringify(parameters, null, 2);
      const blob = new Blob([exportedSettings], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'settings.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    this.pane.addButton({ title: 'Import settings' }).on('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          try {
            const importedSettings = JSON.parse(text);
            Object.assign(parameters, importedSettings);
            localStorage.setItem('parameters', JSON.stringify(parameters));
            window.location = window.location;
            this.pane.refresh();
          } catch (error) {
            console.error('Failed to import settings:', error);
            alert('Invalid settings file.');
          }
        }
      };
      input.click();
    });

    this.tileGenerator = new TileGenerator(
      Math.floor(20 * this.aspectRatio),
      20,
      1 * this.aspectRatio,
      1
    );
    this.mesh = this.tileGenerator.getTileMesh();
    this.mesh.scale.set(2, 2, 1);
    this.scene.add(this.mesh);
  }

  public update() {}

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public init(): Promise<void> {
    // Nothing to do yet
    return Promise.resolve();
  }
  public dispose(): void {
    // Nothing to do yet
  }

  public enterDebug(): void {}

  public exitDebug(): void {}
}
