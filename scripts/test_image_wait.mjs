import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9225;

async function run() {
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    'about:blank',
  ]);

  await new Promise(r => setTimeout(r, 1000));
  const targets = await new Promise((resolve) => {
    http.get('http://localhost:' + port + '/json/list', (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
  });

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
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

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://localhost:5174/events/SK9KyWhskjw7mTbySghQ' });

  // Wait for img to load
  let imgLoaded = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 400));
    const evalRes = await send('Runtime.evaluate', {
      expression: '(() => { const img = document.querySelector(".aspect-video img"); return img ? { complete: img.complete, naturalWidth: img.naturalWidth, src: img.src } : null; })()',
      returnByValue: true
    });
    console.log('Poll', i, evalRes?.result?.value);
    if (evalRes?.result?.value?.naturalWidth > 0) {
      imgLoaded = true;
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('./scratch/details_wait_image.png', Buffer.from(data, 'base64'));
  console.log('Saved ./scratch/details_wait_image.png, imgLoaded:', imgLoaded);

  ws.close();
  proc.kill();
}

run().catch(console.error);
