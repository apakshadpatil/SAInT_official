import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const remotePort = 9223;

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const { WebSocket } = await import('ws').catch(async () => {
      return {
        WebSocket: (await import('child_process')).spawn
      };
    });
  }
}

// Generate banners using pure HTML file opened by chrome --screenshot or html canvas
async function generateWithChrome(width, height, bgColor1, bgColor2, text, subtext, outPath) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: linear-gradient(135deg, ${bgColor1} 0%, ${bgColor2} 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      text-align: center;
    }
    h1 {
      font-size: ${Math.round(width / 24)}px;
      font-weight: 900;
      margin: 0 0 20px 0;
      letter-spacing: 2px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    p {
      font-size: ${Math.round(width / 45)}px;
      font-weight: 600;
      opacity: 0.9;
      margin: 0;
      background: rgba(0,0,0,0.3);
      padding: 10px 24px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.2);
    }
  </style>
</head>
<body>
  <h1>${text}</h1>
  <p>${subtext}</p>
</body>
</html>`;

  const tmpHtml = path.resolve(`./scratch/tmp_${width}x${height}.html`);
  fs.mkdirSync('./scratch', { recursive: true });
  fs.writeFileSync(tmpHtml, html, 'utf8');

  return new Promise((resolve, reject) => {
    const proc = spawn(chromePath, [
      '--headless',
      '--disable-gpu',
      `--window-size=${width},${height}`,
      `--screenshot=${outPath}`,
      `file://${tmpHtml}`,
    ]);
    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpHtml); } catch {}
      if (code === 0) resolve();
      else reject(new Error(`Chrome exited with code ${code}`));
    });
  });
}

async function run() {
  console.log('Generating Banner A (1920x1080, 16:9)...');
  await generateWithChrome(
    1920, 1080,
    '#0f172a', '#1e3a8a',
    'BANNER A — OFFICIAL EVENT BANNER',
    '1920 × 1080 PX • STANDARD 16:9 ASPECT RATIO',
    path.resolve('./scratch/banner_a_1920x1080.png')
  );
  console.log('Banner A generated successfully.');

  console.log('Generating Banner B (1280x720, 16:9)...');
  await generateWithChrome(
    1280, 720,
    '#064e3b', '#065f46',
    'BANNER B — REPLACEMENT BANNER',
    '1280 × 720 PX • STANDARD 16:9 ASPECT RATIO',
    path.resolve('./scratch/banner_b_1280x720.png')
  );
  console.log('Banner B generated successfully.');

  console.log('Generating Banner C (800x800, 1:1 non-16:9)...');
  await generateWithChrome(
    800, 800,
    '#581c87', '#3b0764',
    'BANNER C — SQUARE NON-16:9',
    '800 × 800 PX • 1:1 SQUARE ASPECT RATIO',
    path.resolve('./scratch/banner_c_800x800.png')
  );
  console.log('Banner C generated successfully.');
}

run().catch(console.error);
