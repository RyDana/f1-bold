// import { app } from 'cursor-lib';
import * as THREE from 'three';
// import SoundController, { OscClient, SoundEvent } from './SoundController';
// import instructionsFontPath from './assets/fonts/Sohne-Kraftig.otf';
// import { registerFont } from 'ireg-lib/utils';
import MainScene from './MainScene';

const WIDTH = 208 * 2;
const HEIGHT = 208 * 3;

export default class Application {
  private renderer: THREE.WebGLRenderer;

  private mainScene: MainScene;
  //   private soundController: SoundController<SoundEvent>;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    const container = document.createElement('div');
    document.body.appendChild(container);
    // this.renderer.domElement.style.width = `${
    //   WIDTH / window.devicePixelRatio
    // }px`;
    // this.renderer.domElement.style.height = `${
    //   HEIGHT / window.devicePixelRatio
    // }px`;

    this.renderer.setSize(WIDTH, HEIGHT, false);
    this.renderer.setPixelRatio(1);
    container.appendChild(this.renderer.domElement);

    //Sound controllers
    // this.soundController = new SoundController<string>(
    //   app.settings.get<OscClient | OscClient[]>('soundControllerSonar', {
    //     host: 'localhost',
    //     port: 9999,
    //   })
    // );
  }

  // Load asynchronous assets
  public async init() {
    // await registerFont('cursor-instructions', instructionsFontPath);

    //Scenes
    this.mainScene = new MainScene(
      new THREE.Vector2(WIDTH, HEIGHT),
      this.renderer
      //   this.soundController
    );

    // app.on('enter-debug', () => {
    //   this.mainScene.enterDebug();
    //   console.log('enterDebug');
    //   app.once('exit-debug', () => {
    //     this.mainScene.exitDebug();
    //   });
    // });
  }

  public run() {
    this.renderer.setAnimationLoop(() => {
      this.mainScene.update();
      this.renderer.clear();
      this.mainScene.render();
    });

    // app.on('close', () => {
    //   this.renderer.dispose();
    // });

    // app.open(this.renderer.domElement);
  }
}
