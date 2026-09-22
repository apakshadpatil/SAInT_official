import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9225;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function inspect() {
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  await sleep(1500);
  const version = await fetchJson(`http://localhost:${port}/json/version`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
  };
  function send(method, params = {}) {
    return new Promise(res => {
      const curId = id++;
      callbacks.set(curId, res);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:5174/events/SK9KyWhskjw7mTbySghQ/register' });
  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const b = document.querySelector('.aspect-video');
      if (!b) return { error: 'No aspect-video' };
      const img = b.querySelector('img');
      return {
        outerHTML: b.outerHTML,
        bRect: b.getBoundingClientRect(),
        imgSrc: img ? img.src : null,
        imgComplete: img ? img.complete : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgNaturalHeight: img ? img.naturalHeight : null,
        imgClientWidth: img ? img.clientWidth : null,
        imgClientHeight: img ? img.clientHeight : null,
        imgComputed: img ? {
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility,
          opacity: window.getComputedStyle(img).opacity,
          position: window.getComputedStyle(img).position,
          zIndex: window.getComputedStyle(img).zIndex,
          objectFit: window.getComputedStyle(img).objectFit,
          width: window.getComputedStyle(img).width,
          height: window.getComputedStyle(img).height,
        } : null,
      };
    })()`,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(evalRes, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
