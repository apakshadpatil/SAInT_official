import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.id++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function startChrome() {
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  for (let i = 0; i < 30; i++) {
    await sleep(200);
    try {
      const version = await fetchJson(`http://localhost:${port}/json/version`);
      if (version && version.webSocketDebuggerUrl) {
        return { proc, wsUrl: version.webSocketDebuggerUrl };
      }
    } catch {}
  }
  throw new Error('Chrome failed to start on port ' + port);
}

async function run() {
  console.log('Launching headless Chrome with CDP...');
  const { proc, wsUrl } = await startChrome();

  try {
    const targets = await fetchJson(`http://localhost:${port}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    async function setViewport(width, height, isMobile = false) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: isMobile,
      });
    }

    async function evalScript(expression) {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
      });
      return res?.result?.value;
    }

    async function capture(outPath) {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(outPath, Buffer.from(data, 'base64'));
      console.log(`Saved screenshot: ${outPath}`);
    }

    async function navigateAndWait(url, timeoutMs = 20000) {
      await client.send('Page.navigate', { url });
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        await sleep(400);
        const evalRes = await evalScript(`Boolean(
          document.readyState === 'complete' &&
          !document.body.innerText.includes('Loading Event Details...') &&
          !document.body.innerText.includes('Loading registration...')
        )`);
        if (evalRes === true) {
          break;
        }
      }

      // Now wait until any banner image has finished loading (or fallback is visible)
      const imgStart = Date.now();
      while (Date.now() - imgStart < 15000) {
        const imgStatus = await evalScript(`(() => {
          const banner = document.querySelector('.aspect-video');
          if (!banner) return { done: true, reason: 'no banner' };
          const img = banner.querySelector('img');
          if (!img) return { done: true, reason: 'no img in banner' };
          if (img.complete && img.naturalWidth > 0) return { done: true, reason: 'loaded', width: img.naturalWidth, height: img.naturalHeight };
          return { done: false, complete: img.complete, src: img.src };
        })()`);
        if (imgStatus?.done) {
          await sleep(600); // Allow render paint
          return imgStatus;
        }
        await sleep(300);
      }
      await sleep(600);
    }

    const EVENT_ID = 'SK9KyWhskjw7mTbySghQ';

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: EVENT DETAILS PAGE (Desktop 1280px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Testing Event Details Page (Desktop) ---');
    await setViewport(1280, 900, false);
    await navigateAndWait(`http://localhost:5174/events/${EVENT_ID}`);

    const detailsInfo = await evalScript(`(() => {
      const bannerContainer = document.querySelector('.aspect-video');
      const img = bannerContainer ? bannerContainer.querySelector('img') : null;
      const overlay = bannerContainer ? bannerContainer.querySelector('.banner-overlay') : null;
      const rect = bannerContainer ? bannerContainer.getBoundingClientRect() : null;
      return {
        hasContainer: Boolean(bannerContainer),
        containerRect: rect ? { width: rect.width, height: rect.height } : null,
        imgSrc: img ? img.src : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgNaturalHeight: img ? img.naturalHeight : null,
        hasOverlay: Boolean(overlay),
        overlayColor: overlay ? window.getComputedStyle(overlay).backgroundImage : null,
        title: document.querySelector('h1')?.innerText,
      };
    })()`);

    console.log('Details Page Banner Info:', detailsInfo);
    if (detailsInfo.containerRect) {
      const ratio = detailsInfo.containerRect.width / detailsInfo.containerRect.height;
      console.log(`Container dimensions: ${detailsInfo.containerRect.width} × ${detailsInfo.containerRect.height} px (Ratio: ${ratio.toFixed(3)}:1 - 16:9 is ~1.778)`);
    }
    await capture(path.resolve('./scratch/details_desktop_verified.png'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: EVENT DETAILS PAGE (Mobile 375px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Event Details Page (Mobile 375px) ---');
    await setViewport(375, 812, true);
    await navigateAndWait(`http://localhost:5174/events/${EVENT_ID}`);

    const detailsMobileInfo = await evalScript(`(() => {
      const banner = document.querySelector('.aspect-video');
      const rect = banner ? banner.getBoundingClientRect() : null;
      const scrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      return {
        rect: rect ? { width: rect.width, height: rect.height } : null,
        ratio: rect ? (rect.width / rect.height) : null,
        hasHorizontalOverflow: scrollWidth > innerWidth,
        scrollWidth,
        innerWidth,
      };
    })()`);
    console.log('Details Mobile Info:', detailsMobileInfo);
    await capture(path.resolve('./scratch/details_mobile_verified.png'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: EVENT REGISTRATION PAGE (Desktop 1280px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Event Registration Page (Desktop) ---');
    await setViewport(1280, 900, false);
    await navigateAndWait(`http://localhost:5174/events/${EVENT_ID}/register`);

    const regInfo = await evalScript(`(() => {
      const bannerContainer = document.querySelector('.aspect-video');
      const img = bannerContainer ? bannerContainer.querySelector('img') : null;
      const overlay = bannerContainer ? bannerContainer.querySelector('.banner-overlay') : null;
      const rect = bannerContainer ? bannerContainer.getBoundingClientRect() : null;
      return {
        hasContainer: Boolean(bannerContainer),
        containerRect: rect ? { width: rect.width, height: rect.height } : null,
        imgSrc: img ? img.src : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        imgNaturalHeight: img ? img.naturalHeight : null,
        hasOverlay: Boolean(overlay),
        title: document.querySelector('h1')?.innerText,
      };
    })()`);
    console.log('Register Page Banner Info:', regInfo);
    if (regInfo.containerRect) {
      const ratio = regInfo.containerRect.width / regInfo.containerRect.height;
      console.log(`Register Banner dimensions: ${regInfo.containerRect.width} × ${regInfo.containerRect.height} px (Ratio: ${ratio.toFixed(3)}:1)`);
    }
    const imgDetails = await evalScript(`(() => {
      const img = document.querySelector('.aspect-video img');
      if (!img) return null;
      const cs = window.getComputedStyle(img);
      return {
        rect: img.getBoundingClientRect(),
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        position: cs.position,
        width: cs.width,
        height: cs.height,
        objectFit: cs.objectFit,
      };
    })()`);
    console.log('Register Page <img> details:', imgDetails);
    await capture(path.resolve('./scratch/register_desktop_verified.png'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: EVENT REGISTRATION PAGE (Mobile 375px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Event Registration Page (Mobile 375px) ---');
    await setViewport(375, 812, true);
    await navigateAndWait(`http://localhost:5174/events/${EVENT_ID}/register`);

    const regMobileInfo = await evalScript(`(() => {
      const banner = document.querySelector('.aspect-video');
      const rect = banner ? banner.getBoundingClientRect() : null;
      const scrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      return {
        rect: rect ? { width: rect.width, height: rect.height } : null,
        ratio: rect ? (rect.width / rect.height) : null,
        hasHorizontalOverflow: scrollWidth > innerWidth,
        scrollWidth,
        innerWidth,
      };
    })()`);
    console.log('Register Mobile Info:', regMobileInfo);
    await capture(path.resolve('./scratch/register_mobile_verified.png'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: HOME PAGE EVENT CARDS (Desktop 1280px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Home Page Event Cards ---');
    await setViewport(1280, 900, false);
    await navigateAndWait('http://localhost:5174/#events');

    const homeInfo = await evalScript(`(() => {
      const cards = Array.from(document.querySelectorAll('#events .card'));
      return cards.map(c => {
        const banner = c.querySelector('.aspect-video');
        const rect = banner ? banner.getBoundingClientRect() : null;
        return {
          title: c.querySelector('h3')?.innerText,
          hasAspectVideo: Boolean(banner),
          rect: rect ? { width: rect.width, height: rect.height } : null,
          ratio: rect ? (rect.width / rect.height) : null,
        };
      });
    })()`);
    console.log('Home Event Cards Banner Info:', homeInfo);
    await capture(path.resolve('./scratch/home_desktop_verified.png'));

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: PUBLIC EVENTS EXPLORE PAGE (1280px)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Testing Public Events Page ---');
    await navigateAndWait('http://localhost:5174/events');
    const eventsInfo = await evalScript(`(() => {
      const banners = Array.from(document.querySelectorAll('.aspect-video'));
      const rect = banners[0] ? banners[0].getBoundingClientRect() : null;
      return {
        bannerCount: banners.length,
        firstRect: rect ? { width: rect.width, height: rect.height } : null,
        ratio: rect ? (rect.width / rect.height) : null,
      };
    })()`);
    console.log('Public Events Page Info:', eventsInfo);
    await capture(path.resolve('./scratch/events_desktop_verified.png'));

    await client.close();
    console.log('\nVerification suite completed successfully!');
  } finally {
    proc.kill();
  }
}

run().catch(console.error);
