// Runs axe-core against the built timeline (`vite preview`, which mirrors
// GitHub Pages) at the launch viewports in both locales, in each UI state that
// adds chrome. Exits non-zero on any violation not listed in
// a11y-baseline.json, so "axe clean" is a pass/fail result.
//
// Usage: npm run a11y --workspace packages/web   (builds first)
// Needs a Playwright Chromium: `npx playwright install chromium`.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const baseline = JSON.parse(
  readFileSync(new URL('./a11y-baseline.json', import.meta.url), 'utf8'),
);

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];
const LOCALE_PREFIXES = ['', '/ru'];
const COMPARISON_QUERY = '?e=albert-einstein&e=steve-jobs';

// Each state is a path plus whatever it takes to reach the UI under test.
const STATES = [
  { name: 'timeline', query: '' },
  {
    name: 'filters open',
    query: '',
    open: (page) => page.click('button[aria-haspopup="dialog"]'),
  },
  {
    name: 'help open',
    query: '',
    open: (page) => page.click('button[aria-keyshortcuts="?"]'),
  },
  {
    name: 'comparison open',
    query: COMPARISON_QUERY,
    open: (page) => page.waitForSelector('[data-overlap-band]'),
  },
];

function isBaselined(ruleId, target) {
  return baseline.some(
    (entry) =>
      entry.rule === ruleId && new RegExp(entry.target).test(String(target)),
  );
}

const server = await preview({ preview: { port: 4199, strictPort: false } });
const origin = server.resolvedUrls?.local[0];
if (!origin) throw new Error('vite preview reported no local URL');

const browser = await chromium.launch();
const failures = [];
let runs = 0;

try {
  for (const prefix of LOCALE_PREFIXES) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width < 800,
        isMobile: viewport.width < 800,
      });
      for (const state of STATES) {
        const page = await context.newPage();
        const url = `${origin.replace(/\/$/, '')}${prefix}/timeline/${state.query}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        await state.open?.(page);
        await page.waitForTimeout(400);
        await page.evaluate(axeSource);
        const violations = await page.evaluate(async () => {
          const { violations } = await window.axe.run();
          return violations.flatMap((violation) =>
            violation.nodes.map((node) => ({
              rule: violation.id,
              target: node.target.join(' '),
            })),
          );
        });
        runs += 1;
        for (const { rule, target } of violations) {
          if (isBaselined(rule, target)) continue;
          failures.push(
            `${prefix || '/en'} ${viewport.width}px [${state.name}] ${rule}: ${target}`,
          );
        }
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length > 0) {
  console.error(`axe: ${failures.length} new violation(s)\n`);
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`axe: no new violations across ${runs} runs`);
