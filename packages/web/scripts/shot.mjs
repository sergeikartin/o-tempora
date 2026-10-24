// Screenshots the built timeline (`vite preview`, which mirrors GitHub Pages)
// at a chosen viewport, optionally after driving it, so a UI change can be
// seen in the real app.
//
// Usage: npm run shot --workspace packages/web -- [options]   (builds first)
//   --path   URL path + query to open          (default /timeline/)
//   --width  viewport width in px              (default 390; < 800 is touch)
//   --height viewport height in px             (default 844)
//   --step   repeatable, run in order:
//              tap:<x>,<y>      touch tap at page coordinates
//              click:<selector> click the first match
//              wait:<ms>        pause
//              eval:<js>        print the JS expression's result
//   --out    PNG path (default <tmpdir>/o-tempora-shot.png)
// Needs a Playwright Chromium: `npx playwright install chromium`.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const { values } = parseArgs({
  options: {
    path: { type: 'string', default: '/timeline/' },
    width: { type: 'string', default: '390' },
    height: { type: 'string', default: '844' },
    step: { type: 'string', multiple: true, default: [] },
    out: { type: 'string', default: join(tmpdir(), 'o-tempora-shot.png') },
  },
});
const width = Number(values.width);
const isTouch = width < 800;

async function runStep(page, step) {
  const colon = step.indexOf(':');
  const kind = step.slice(0, colon);
  const arg = step.slice(colon + 1);
  if (kind === 'tap') {
    const [x, y] = arg.split(',').map(Number);
    await page.touchscreen.tap(x, y);
  } else if (kind === 'click') {
    await page.click(arg);
  } else if (kind === 'wait') {
    await page.waitForTimeout(Number(arg));
  } else if (kind === 'eval') {
    console.log(await page.evaluate(arg));
  } else {
    throw new Error(`unknown step "${step}"`);
  }
}

const server = await preview({ preview: { port: 4199, strictPort: false } });
const origin = server.resolvedUrls?.local[0];
if (!origin) throw new Error('vite preview reported no local URL');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width, height: Number(values.height) },
    hasTouch: isTouch,
    isMobile: isTouch,
  });
  const page = await context.newPage();
  await page.goto(`${origin.replace(/\/$/, '')}${values.path}`, {
    waitUntil: 'networkidle',
  });
  for (const step of values.step) await runStep(page, step);
  await page.screenshot({ path: values.out });
  console.log(`screenshot: ${values.out}`);
} finally {
  await browser.close();
  await server.close();
}
