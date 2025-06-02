import Application from './Application';
// import { app } from 'cursor-lib';

async function main() {
  let entry = 'main'; //app.settings.get<string>('entry', 'main');

  let chapter;
  switch (entry) {
    case 'main':
      chapter = new Application();
      break;
    default:
      new Error(`Unknown entry point: ${entry}`);
      break;
  }

  if (!chapter) return;
  await chapter.init();
  chapter.run();
}

main();
