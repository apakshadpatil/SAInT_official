import { spawn } from 'child_process';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function capture(url, out, w = 1280, h = 800) {
  return new Promise((resolve, reject) => {
    const p = spawn(chromePath, [
      '--headless',
      '--disable-gpu',
      `--window-size=${w},${h}`,
      '--virtual-time-budget=5000',
      `--screenshot=${path.resolve(out)}`,
      url
    ]);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Failed with code ${code}`));
    });
  });
}

async function run() {
  console.log('Capturing Home...');
  await capture('http://localhost:5174/#events', './scratch/home_16x9_test.png', 1280, 900);
  console.log('Capturing Events Page...');
  await capture('http://localhost:5174/events', './scratch/events_16x9_test.png', 1280, 900);
  console.log('Capturing Details Page Desktop...');
  await capture('http://localhost:5174/events/SK9KyWhskjw7mTbySghQ', './scratch/details_16x9_desktop.png', 1280, 900);
  console.log('Capturing Register Page Desktop...');
  await capture('http://localhost:5174/events/SK9KyWhskjw7mTbySghQ/register', './scratch/register_16x9_desktop.png', 1280, 900);
  console.log('Capturing Details Page Mobile (375px)...');
  await capture('http://localhost:5174/events/SK9KyWhskjw7mTbySghQ', './scratch/details_16x9_mobile.png', 375, 812);
  console.log('Capturing Register Page Mobile (375px)...');
  await capture('http://localhost:5174/events/SK9KyWhskjw7mTbySghQ/register', './scratch/register_16x9_mobile.png', 375, 812);
  console.log('All screenshots captured successfully!');
}

run().catch(console.error);
