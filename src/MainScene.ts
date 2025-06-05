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
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import { TileGenerator } from './TileGenerator';
import { TileMaterial } from './TileMaterial';

const defaultSettings = {
  uGradientTexture: [
    { time: 0.0, value: { r: 0, g: 0, b: 0, a: 1 } },
    { time: 0.808, value: { r: 0, g: 0, b: 255, a: 1 } },
    {
      time: 1,
      value: { r: 108, g: 204, b: 204, a: 1 },
    },
  ],
  uGradientDivisions: 1.0,
  uVignetteSize: 0.1,
  uSpeed: 0.1,
  uAsyncPos: 0.0,
  uAsyncSpeed: 0.1,
  iterationRange: { min: 1, max: 4 },
  divisionRange: { min: 2, max: 8 },
  concentricRange: { min: 5, max: 8 },
};

export type Params = typeof defaultSettings;
export type RemappedParams = {
  [K in keyof Params]: { value: Params[K] };
};

const parameters = autoSaveToLocalStorage('parameters-bold', {
  ...defaultSettings,
  ...JSON.parse(localStorage.getItem('parameters-bold') ?? '{}'),
});

export default class MainScene {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private aspectRatio: number = 1;
  private mesh: THREE.Mesh;
  private pane = new Pane();
  tileGenerator: TileGenerator;

  constructor(
    private dimensions: THREE.Vector2,
    private renderer: THREE.WebGLRenderer // private soundController: SoundController<SoundEvent>,
  ) {
    this.aspectRatio = dimensions.width / dimensions.height;
    const sceneDimensions = new THREE.Vector2(1 * this.aspectRatio, 1);
    this.camera = new THREE.OrthographicCamera(
      -sceneDimensions.x / 2,
      sceneDimensions.x / 2,
      sceneDimensions.y / 2,
      -sceneDimensions.y / 2,
      -10,
      10
    );
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xff0000);

    //PANE
    this.pane.registerPlugin(GradientPluginBundle);
    this.pane.registerPlugin(EssentialsPlugin);
    this.pane.addButton({ title: 'Reset settings' }).on('click', () => {
      localStorage.removeItem('parameters');
      //@ts-ignore
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
            //@ts-ignore
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

    this.tileGenerator = new TileGenerator(sceneDimensions, parameters);
    this.mesh = this.tileGenerator.getTileMesh(parameters);
    this.scene.add(this.mesh);

    const gradientFolder = this.pane.addFolder({
      title: 'Gradient Settings',
      expanded: true,
    });

    //Settings
    const api = gradientFolder.addBlade({
      view: 'gradient',
      initialPoints: parameters.uGradientTexture,
      label: 'Color',
      colorPicker: true,
      colorPickerProps: {
        alpha: true,
        layout: 'popup',
        expanded: false,
      },
      alphaPicker: false,
      timePicker: false,
      timeStep: 0.001,
      timeDecimalPrecision: 4,
    }) as GradientBladeApi;
    api.on('change', (ev) => {
      parameters.uGradientTexture = ev.value.points;
      (this.mesh.material as TileMaterial).setGradient(ev.value.points);
    });

    gradientFolder
      .addBinding(parameters, 'uGradientDivisions', {
        label: 'Divisions',
        min: 0,
        max: 10,
      })
      .on('change', (ev) => {
        (this.mesh.material as TileMaterial).setGradientDivisions(ev.value);
      });
    gradientFolder
      .addBinding(parameters, 'uVignetteSize', {
        label: 'Vignette',
        min: 0,
        max: 1,
      })
      .on('change', (ev) => {
        (this.mesh.material as TileMaterial).setVignetteSize(ev.value);
      });
    gradientFolder
      .addBinding(parameters, 'uSpeed', {
        label: 'Speed',
        min: 0,
        max: 10,
      })
      .on('change', (ev) => {
        (this.mesh.material as TileMaterial).setSpeed(ev.value);
      });

    gradientFolder
      .addBinding(parameters, 'uAsyncPos', {
        label: 'Sync Position',
        min: 0,
        max: 10,
      })
      .on('change', (ev) => {
        (this.mesh.material as TileMaterial).setAsyncPos(ev.value);
      });

    gradientFolder
      .addBinding(parameters, 'uAsyncSpeed', {
        label: 'Sync Speed',
        min: 0,
        max: 10,
      })
      .on('change', (ev) => {
        (this.mesh.material as TileMaterial).setAsyncSpeed(ev.value);
      });

    const tilingFolder = this.pane.addFolder({
      title: 'Tiling Settings',
      expanded: true,
    });

    tilingFolder
      .addBinding(parameters, 'iterationRange', {
        label: 'Iteration Range',
        min: 0,
        max: 30,
        step: 1,
      })
      .on('change', (ev) => {
        this.scene.remove(this.mesh);
        this.mesh = this.tileGenerator.getTileMesh(parameters);
        this.scene.add(this.mesh);
      });

    tilingFolder
      .addBinding(parameters, 'divisionRange', {
        label: 'Division Range',
        min: 0,
        max: 30,
        step: 1,
      })
      .on('change', (ev) => {
        this.scene.remove(this.mesh);
        this.mesh = this.tileGenerator.getTileMesh(parameters);
        this.scene.add(this.mesh);
      });

    tilingFolder
      .addBinding(parameters, 'concentricRange', {
        label: 'Concentric Range',
        min: 0,
        max: 30,
        step: 1,
      })
      .on('change', (ev) => {
        this.scene.remove(this.mesh);
        this.mesh = this.tileGenerator.getTileMesh(parameters);
        this.scene.add(this.mesh);
      });
  }

  public update() {
    this.tileGenerator.update();
  }

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
