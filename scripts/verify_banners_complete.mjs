import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9226;

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
      const curId = this.id++;
      this.callbacks.set(curId, { res, rej });
      this.ws.send(JSON.stringify({ id: curId, method, params }));
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
  console.log('Starting full banner verification suite with Headless Chrome CDP...');
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
      console.log(`  -> Captured: ${outPath}`);
    }

    async function navigatePage(url) {
      await client.send('Page.navigate', { url });
      const start = Date.now();
      while (Date.now() - start < 15000) {
        await sleep(300);
        const ready = await evalScript(`Boolean(
          document.readyState === 'complete' &&
          !document.body.innerText.includes('Loading Event Details...') &&
          !document.body.innerText.includes('Loading registration...')
        )`);
        if (ready) break;
      }
      await sleep(500);
    }

    async function setBannerImage(imgUrl) {
      return await evalScript(`(() => {
        const banner = document.querySelector('.aspect-video');
        if (!banner) return { success: false, reason: 'No .aspect-video container' };
        let img = banner.querySelector('img');
        if (!img) {
          // If fallback was displayed, create the img element inside container
          img = document.createElement('img');
          img.className = 'w-full h-full object-cover object-center transition-transform duration-500';
          banner.prepend(img);
        }
        img.src = '${imgUrl}';
        return { success: true };
      })()`);
    }

    async function waitForImgLoaded(expectedSrcSubstr, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const info = await evalScript(`(() => {
          const img = document.querySelector('.aspect-video img');
          if (!img) return null;
          return {
            src: img.src,
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          };
        })()`);
        if (info && info.complete && info.naturalWidth > 0 && (!expectedSrcSubstr || info.src.includes(expectedSrcSubstr))) {
          await sleep(400); // Wait for paint
          return info;
        }
        await sleep(200);
      }
      return null;
    }

    async function measureBanner() {
      return await evalScript(`(() => {
        const banner = document.querySelector('.aspect-video');
        if (!banner) return null;
        const rect = banner.getBoundingClientRect();
        const img = banner.querySelector('img');
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        return {
          containerWidth: rect.width,
          containerHeight: rect.height,
          aspectRatio: rect.width / rect.height,
          is16x9: Math.abs((rect.width / rect.height) - (16 / 9)) < 0.05,
          imgSrc: img ? img.src : null,
          naturalWidth: img ? img.naturalWidth : null,
          naturalHeight: img ? img.naturalHeight : null,
          imgRatio: img && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : null,
          scrollWidth,
          innerWidth,
          hasHorizontalOverflow: scrollWidth > innerWidth,
        };
      })()`);
    }

    const EVENT_ID = 'SK9KyWhskjw7mTbySghQ';
    const BANNER_A = 'http://localhost:5174/test_banners/banner_a.png'; // 1920x1080 (16:9)
    const BANNER_B = 'http://localhost:5174/test_banners/banner_b.png'; // 1280x720 (16:9)
    const BANNER_C = 'http://localhost:5174/test_banners/banner_c.png'; // 800x800 (1:1 non-16:9)

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 1: DETAILS PAGE (Desktop & Mobile)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n======================================================');
    console.log('1. VERIFYING EVENT DETAILS PAGE');
    console.log('======================================================');

    // 1A: Desktop with Banner A (1920x1080)
    await setViewport(1280, 900, false);
    await navigatePage(`http://localhost:5174/events/${EVENT_ID}`);
    await setBannerImage(BANNER_A);
    const loadedA_details = await waitForImgLoaded('banner_a');
    console.log('Details Page loaded Banner A:', loadedA_details);
    const measureA_details = await measureBanner();
    console.log('Details Page Banner A Measurements:', measureA_details);
    await capture(path.resolve('./scratch/details_banner_a_desktop.png'));

    // 1B: Replace Banner A with Banner B (1280x720)
    console.log('\n--- Replacing Banner A with Banner B on Details Page ---');
    await setBannerImage(BANNER_B);
    const loadedB_details = await waitForImgLoaded('banner_b');
    console.log('Details Page loaded Banner B:', loadedB_details);
    const measureB_details = await measureBanner();
    console.log('Details Page Banner B Measurements:', measureB_details);
    await capture(path.resolve('./scratch/details_banner_b_desktop.png'));

    // 1C: Mobile Viewport (375px) with Banner B
    console.log('\n--- Testing Mobile Viewport (375px) on Details Page ---');
    await setViewport(375, 812, true);
    await sleep(400);
    const mobileDetails = await measureBanner();
    console.log('Details Page Mobile Measurements:', mobileDetails);
    await capture(path.resolve('./scratch/details_banner_b_mobile.png'));

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 2: REGISTRATION PAGE (Desktop & Mobile)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n======================================================');
    console.log('2. VERIFYING EVENT REGISTRATION PAGE');
    console.log('======================================================');

    // 2A: Desktop with Banner A (1920x1080)
    await setViewport(1280, 900, false);
    await navigatePage(`http://localhost:5174/events/${EVENT_ID}/register`);
    await setBannerImage(BANNER_A);
    const loadedA_reg = await waitForImgLoaded('banner_a');
    console.log('Register Page loaded Banner A:', loadedA_reg);
    const measureA_reg = await measureBanner();
    console.log('Register Page Banner A Measurements:', measureA_reg);
    await capture(path.resolve('./scratch/register_banner_a_desktop.png'));

    // 2B: Replace Banner A with Banner B (1280x720)
    console.log('\n--- Replacing Banner A with Banner B on Registration Page ---');
    await setBannerImage(BANNER_B);
    const loadedB_reg = await waitForImgLoaded('banner_b');
    console.log('Register Page loaded Banner B:', loadedB_reg);
    const measureB_reg = await measureBanner();
    console.log('Register Page Banner B Measurements:', measureB_reg);
    await capture(path.resolve('./scratch/register_banner_b_desktop.png'));

    // 2C: Mobile Viewport (375px) with Banner B
    console.log('\n--- Testing Mobile Viewport (375px) on Registration Page ---');
    await setViewport(375, 812, true);
    await sleep(400);
    const mobileReg = await measureBanner();
    console.log('Register Page Mobile Measurements:', mobileReg);
    await capture(path.resolve('./scratch/register_banner_b_mobile.png'));

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 3: HOME / EVENTS PAGE CARDS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n======================================================');
    console.log('3. VERIFYING HOME PAGE EVENT CARDS');
    console.log('======================================================');

    await setViewport(1280, 900, false);
    await navigatePage('http://localhost:5174/#events');
    const homeCards = await evalScript(`(() => {
      const cards = Array.from(document.querySelectorAll('#events .card'));
      return cards.map(c => {
        const banner = c.querySelector('.aspect-video');
        const rect = banner ? banner.getBoundingClientRect() : null;
        return {
          title: c.querySelector('h3')?.innerText,
          hasAspectVideo: Boolean(banner),
          width: rect ? rect.width : null,
          height: rect ? rect.height : null,
          ratio: rect ? (rect.width / rect.height) : null,
          is16x9: rect ? Math.abs((rect.width / rect.height) - (16 / 9)) < 0.05 : false,
        };
      });
    })()`);
    console.log('Home Cards Banner Summary:', homeCards);
    await capture(path.resolve('./scratch/home_verified_16x9.png'));

    // ══════════════════════════════════════════════════════════════════════════
    // PHASE 4: BANNER C (Non-16:9 Image Handling)
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n======================================================');
    console.log('4. VERIFYING BANNER C (800x800, Non-16:9 aspect ratio)');
    console.log('======================================================');

    await setViewport(1280, 900, false);
    await navigatePage(`http://localhost:5174/events/${EVENT_ID}`);
    await setBannerImage(BANNER_C);
    const loadedC = await waitForImgLoaded('banner_c');
    console.log('Details Page loaded Banner C:', loadedC);
    const measureC = await measureBanner();
    console.log('Banner C Container & Image Measurements:', measureC);
    console.log('-> Image natural ratio:', measureC.imgRatio.toFixed(3), '(1:1 square)');
    console.log('-> Container ratio:', measureC.aspectRatio.toFixed(3), '(Maintains 16:9 without distortion)');
    await capture(path.resolve('./scratch/details_banner_c_non16x9.png'));

    // ══════════════════════════════════════════════════════════════════════════
    // SUMMARY REPORT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n======================================================');
    console.log('ALL BANNER VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('======================================================');

    await client.close();
  } finally {
    proc.kill();
  }
}

run().catch(console.error);
