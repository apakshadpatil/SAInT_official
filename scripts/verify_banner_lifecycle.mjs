import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const firebaseConfig = {
  apiKey: "AIzaSyBl-vfnhufHAyvR4nOJNd-DCkm5lCZJ-Sk",
  authDomain: "saintjspmrscoe.firebaseapp.com",
  projectId: "saintjspmrscoe",
  storageBucket: "saintjspmrscoe.firebasestorage.app",
  messagingSenderId: "53248989106",
  appId: "1:53248989106:web:9729ce758edbfcee83f6ab",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EVENT_ID = 'SK9KyWhskjw7mTbySghQ';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const urls = JSON.parse(fs.readFileSync(path.resolve('./scratch/test_banner_urls.json'), 'utf8'));
const { urlA, urlB } = urls;

function captureScreenshot(url, outPath, width = 1280, height = 800) {
  return new Promise((resolve, reject) => {
    const proc = spawn(chromePath, [
      '--headless',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      '--virtual-time-budget=4000',
      `--screenshot=${outPath}`,
      url
    ]);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chrome exited with code ${code} for ${url}`));
    });
  });
}

async function updateEventBanner(bannerUrl) {
  console.log(`Setting event ${EVENT_ID} banner to: ${bannerUrl}`);
  const eventRef = doc(db, 'events', EVENT_ID);
  await updateDoc(eventRef, {
    imageURL: bannerUrl,
    registrationBannerUrl: bannerUrl,
    updatedAt: new Date().toISOString()
  });
  console.log('Firestore document updated successfully.');
}

async function run() {
  console.log('====================================================');
  console.log('PHASE 1: SET BANNER A (1920x1080, 16:9)');
  console.log('====================================================');
  await updateEventBanner(urlA);
  // Give dev server a moment for Firestore real-time listener to propagate
  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturing Phase 1 (Banner A) Desktop Screenshots...');
  await captureScreenshot('http://localhost:5174/#events', path.resolve('./scratch/phase1_home_desktop.png'), 1280, 900);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}`, path.resolve('./scratch/phase1_details_desktop.png'), 1280, 900);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}/register`, path.resolve('./scratch/phase1_register_desktop.png'), 1280, 900);

  console.log('Capturing Phase 1 (Banner A) Mobile (375px) Screenshots...');
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}`, path.resolve('./scratch/phase1_details_mobile.png'), 375, 812);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}/register`, path.resolve('./scratch/phase1_register_mobile.png'), 375, 812);
  console.log('Phase 1 screenshots saved successfully.');

  console.log('\n====================================================');
  console.log('PHASE 2: REPLACE BANNER A WITH BANNER B (1280x720, 16:9)');
  console.log('====================================================');
  await updateEventBanner(urlB);
  await new Promise(r => setTimeout(r, 2000));

  console.log('Capturing Phase 2 (Banner B) Desktop Screenshots...');
  await captureScreenshot('http://localhost:5174/#events', path.resolve('./scratch/phase2_home_desktop.png'), 1280, 900);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}`, path.resolve('./scratch/phase2_details_desktop.png'), 1280, 900);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}/register`, path.resolve('./scratch/phase2_register_desktop.png'), 1280, 900);

  console.log('Capturing Phase 2 (Banner B) Mobile (375px) Screenshots...');
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}`, path.resolve('./scratch/phase2_details_mobile.png'), 375, 812);
  await captureScreenshot(`http://localhost:5174/events/${EVENT_ID}/register`, path.resolve('./scratch/phase2_register_mobile.png'), 375, 812);
  console.log('Phase 2 screenshots saved successfully.');

  console.log('\nAll lifecycle verification captures completed successfully!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
