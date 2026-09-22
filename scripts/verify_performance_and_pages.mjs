import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9226;

async function verify() {
  console.log('--- Starting Chrome for Performance & Functional Verification ---');
  const tempProfile = `C:\\Users\\Nilam\\AppData\\Local\\Temp\\chrome_perf_${Date.now()}`;
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    'about:blank',
  ]);

  let targets = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json/list`, (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
          });
        }).on('error', reject);
      });
      if (targets && targets.length > 0 && targets[0].webSocketDebuggerUrl) {
        break;
      }
    } catch {
      // Retry
    }
  }

  if (!targets || !targets[0]?.webSocketDebuggerUrl) {
    throw new Error('Failed to connect to headless Chrome on port ' + port);
  }

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));

  let id = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const curId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const consoleErrors = [];
  const networkErrors = [];

  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error') {
        const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleErrors.push(text);
      }
    }
    if (msg.method === 'Network.responseReceived') {
      if (msg.params.response.status >= 400) {
        networkErrors.push(`${msg.params.response.status}: ${msg.params.response.url}`);
      }
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

  const routes = [
    { name: 'Home Page', url: 'http://localhost:5174/' },
    { name: 'Public Events Page', url: 'http://localhost:5174/events' },
    { name: 'Event Details Page', url: 'http://localhost:5174/events/SK9KyWhskjw7mTbySghQ' },
    { name: 'Event Register Page', url: 'http://localhost:5174/events/SK9KyWhskjw7mTbySghQ/register' },
    { name: 'Activities Page', url: 'http://localhost:5174/activities' },
  ];

  for (const route of routes) {
    console.log(`\nNavigating to: ${route.name} (${route.url})`);
    await send('Page.navigate', { url: route.url });
    await new Promise((r) => setTimeout(r, 1500));

    const pageState = await send('Runtime.evaluate', {
      expression: `(() => {
        const bannerImg = document.querySelector('.aspect-video img');
        const cards = document.querySelectorAll('.aspect-video');
        return {
          title: document.title,
          doomsday: document.documentElement.getAttribute('data-doomsday'),
          bannerFound: Boolean(bannerImg || cards.length > 0),
          bannerImgComplete: bannerImg ? bannerImg.complete : null,
          bannerNaturalWidth: bannerImg ? bannerImg.naturalWidth : null,
          videoAspectContainers: cards.length
        };
      })()`,
      returnByValue: true,
    });

    console.log(`Result for ${route.name}:`, pageState?.result?.value);
  }

  // Ensure scratch dir exists
  if (!fs.existsSync('./scratch')) fs.mkdirSync('./scratch', { recursive: true });

  // Capture final screenshot of Home
  await send('Page.navigate', { url: 'http://localhost:5174/' });
  await new Promise((r) => setTimeout(r, 1500));
  const { data: homeImg } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('./scratch/perf_verify_home.png', Buffer.from(homeImg, 'base64'));
  console.log('Saved ./scratch/perf_verify_home.png');

  // Capture Details page
  await send('Page.navigate', { url: 'http://localhost:5174/events/SK9KyWhskjw7mTbySghQ' });
  await new Promise((r) => setTimeout(r, 1500));
  const { data: detailsImg } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('./scratch/perf_verify_details.png', Buffer.from(detailsImg, 'base64'));
  console.log('Saved ./scratch/perf_verify_details.png');

  console.log('\n--- Verification Summary ---');
  console.log('Total Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Console Errors:', consoleErrors);
  }
  console.log('Total Network 4xx/5xx Responses:', networkErrors.length);
  if (networkErrors.length > 0) {
    console.log('Network Errors:', networkErrors);
  }

  ws.close();
  proc.kill();
  console.log('Verification finished successfully.');
}

verify().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
