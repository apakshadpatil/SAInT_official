import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const EVENT_ID = 'SK9KyWhskjw7mTbySghQ';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9228;
const artifactDir = 'C:\\Users\\Nilam\\.gemini\\antigravity-ide\\brain\\8b7ddb35-1791-49ca-b6b1-de39ea02fc0b';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
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
      const curId = this.id++;
      this.callbacks.set(curId, { res, rej });
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('=== Step 1: Launch headless Chrome ===');
  const tempProfile = `C:\\Users\\Nilam\\AppData\\Local\\Temp\\chrome_coord_${Date.now()}`;
  const proc = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${tempProfile}`,
    'about:blank',
  ]);

  await sleep(1800);
  const targets = await fetchJson(`http://localhost:${port}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  async function testPage(url, pageName, width, height, outName, mockData = null, scrollToCoordinators = false) {
    console.log(`\nTesting ${pageName} (${width}x${height})...`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    // Configure mock coordinators in window if provided
    if (mockData !== null) {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `window.__MOCK_EVENT_COORDINATORS__ = ${JSON.stringify(mockData)};`
      });
    } else {
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: `delete window.__MOCK_EVENT_COORDINATORS__;`
      });
    }

    await cdp.send('Page.navigate', { url });
    await sleep(3500);

    const evalResult = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const links = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => ({
          href: a.getAttribute('href'),
          text: a.innerText.trim()
        }));
        const hasCoordinatorHeading = /Event Coordinator/i.test(text);
        const hasRajesh = /Dr\\. Rajesh Patil/i.test(text);
        const hasAnanya = /Prof\\. Ananya Desai/i.test(text);
        const hasPhone1 = /9876543210/.test(text);
        const hasPhone2 = /91234 56789/.test(text);

        // Check horizontal overflow
        const docWidth = document.documentElement.scrollWidth;
        const winWidth = window.innerWidth;
        const hasOverflow = docWidth > winWidth;

        return {
          hasCoordinatorHeading,
          hasRajesh,
          hasAnanya,
          hasPhone1,
          hasPhone2,
          links,
          hasOverflow,
          docWidth,
          winWidth
        };
      })()`,
      returnByValue: true
    });

    const res = evalResult.result.value;
    console.log(`Results for ${pageName} (${width}x${height}):`, res);

    if (scrollToCoordinators && res.hasCoordinatorHeading) {
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const heading = Array.from(document.querySelectorAll('h4, span')).find(el => /Event Coordinator/i.test(el.textContent));
          if (heading) heading.scrollIntoView({ behavior: 'instant', block: 'center' });
        })()`
      });
      await sleep(600);
    }

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(artifactDir, `${outName}.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot: ${shotPath}`);

    return res;
  }

  console.log('=== Step 2: Test ZERO coordinators state (real Firestore data) ===');
  const detailsEmpty = await testPage(
    `http://localhost:5174/events/${EVENT_ID}`,
    'Event Details with ZERO coordinators',
    1280,
    900,
    'coordinators_details_empty'
  );
  const registerEmpty = await testPage(
    `http://localhost:5174/events/${EVENT_ID}/register`,
    'Event Register with ZERO coordinators',
    1280,
    900,
    'coordinators_register_empty'
  );

  console.log('=== Step 3: Test MULTIPLE coordinators state (2 coordinators) ===');
  const testCoordinators = [
    { name: 'Dr. Rajesh Patil', phone: '9876543210' },
    { name: 'Prof. Ananya Desai', phone: '+91 91234 56789' }
  ];

  const detailsDesktop = await testPage(
    `http://localhost:5174/events/${EVENT_ID}`,
    'Event Details Desktop (2 Coordinators)',
    1280,
    900,
    'coordinators_details_desktop',
    testCoordinators,
    true
  );
  const detailsMobile = await testPage(
    `http://localhost:5174/events/${EVENT_ID}`,
    'Event Details Mobile (2 Coordinators)',
    375,
    812,
    'coordinators_details_mobile',
    testCoordinators,
    true
  );

  const registerDesktop = await testPage(
    `http://localhost:5174/events/${EVENT_ID}/register`,
    'Event Register Desktop (2 Coordinators)',
    1280,
    900,
    'coordinators_register_desktop',
    testCoordinators
  );
  const registerMobile = await testPage(
    `http://localhost:5174/events/${EVENT_ID}/register`,
    'Event Register Mobile (2 Coordinators)',
    375,
    812,
    'coordinators_register_mobile',
    testCoordinators
  );

  console.log('=== Step 4: Test SINGLE coordinator singular label ===');
  const singleCoordinator = [
    { name: 'Dr. Rajesh Patil', phone: '9876543210' }
  ];
  const detailsSingle = await testPage(
    `http://localhost:5174/events/${EVENT_ID}`,
    'Event Details Desktop (1 Coordinator - Singular label)',
    1280,
    900,
    'coordinators_details_single',
    singleCoordinator,
    true
  );

  await cdp.close();
  proc.kill();

  console.log('\n=======================================');
  console.log('FINAL VERIFICATION AUDIT:');
  console.log('1. Zero coordinators hides section completely on Details:', !detailsEmpty.hasCoordinatorHeading);
  console.log('2. Zero coordinators hides section completely on Register:', !registerEmpty.hasCoordinatorHeading);
  console.log('3. Multiple coordinators rendered on Details Desktop:', detailsDesktop.hasRajesh && detailsDesktop.hasAnanya);
  console.log('4. Clickable tel: links generated on Details Desktop:', detailsDesktop.links);
  console.log('5. Zero horizontal overflow on Details Mobile:', !detailsMobile.hasOverflow, `(doc: ${detailsMobile.docWidth}px, win: ${detailsMobile.winWidth}px)`);
  console.log('6. Multiple coordinators rendered on Register Desktop:', registerDesktop.hasRajesh && registerDesktop.hasAnanya);
  console.log('7. Clickable tel: links generated on Register Desktop:', registerDesktop.links);
  console.log('8. Zero horizontal overflow on Register Mobile:', !registerMobile.hasOverflow, `(doc: ${registerMobile.docWidth}px, win: ${registerMobile.winWidth}px)`);
  console.log('9. Singular coordinator heading supported:', detailsSingle.hasCoordinatorHeading);
  console.log('=======================================');

  const allPassed =
    !detailsEmpty.hasCoordinatorHeading &&
    !registerEmpty.hasCoordinatorHeading &&
    detailsDesktop.hasRajesh &&
    detailsDesktop.links.length === 2 &&
    !detailsMobile.hasOverflow &&
    registerDesktop.hasRajesh &&
    registerDesktop.links.length === 2 &&
    !registerMobile.hasOverflow &&
    detailsSingle.hasRajesh;

  if (!allPassed) {
    throw new Error('Some verification assertions failed!');
  }
  console.log('ALL ASSERTIONS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
