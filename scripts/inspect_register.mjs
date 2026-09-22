import { spawn } from 'child_process';
import http from 'http';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;

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
      callbacks.get(msg.id)(msg.result);
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
      const banner = document.querySelector('.aspect-video');
      if (!banner) return { error: 'No banner' };
      const img = banner.querySelector('img');
      const overlay = banner.querySelector('.banner-overlay');
      const bannerStyle = window.getComputedStyle(banner);
      const imgStyle = img ? window.getComputedStyle(img) : null;
      const overlayStyle = overlay ? window.getComputedStyle(overlay) : null;

      return {
        banner: {
          bg: bannerStyle.backgroundColor,
          bgImg: bannerStyle.backgroundImage,
          rect: banner.getBoundingClientRect(),
        },
        img: img ? {
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          display: imgStyle.display,
          visibility: imgStyle.visibility,
          opacity: imgStyle.opacity,
          zIndex: imgStyle.zIndex,
          rect: img.getBoundingClientRect(),
        } : null,
        overlay: overlay ? {
          bg: overlayStyle.backgroundColor,
          bgImg: overlayStyle.backgroundImage,
          opacity: overlayStyle.opacity,
          zIndex: overlayStyle.zIndex,
          rect: overlay.getBoundingClientRect(),
        } : null,
      };
    })()`,
    returnByValue: true
  });

  console.log('Register Banner Inspection Result:\n', JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  proc.kill();
}

inspect().catch(console.error);
