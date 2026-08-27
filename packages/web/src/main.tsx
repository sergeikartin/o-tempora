// Self-hosted at build time (no runtime network fetch) — weights match what
// docs/design-tokens.md's Typography table and the CSS below actually use.
// Archivo covers UI chrome, entry labels, and data (tabular-nums, no
// separate mono face); Fraunces is the display face, used sparingly
// (DetailPanel's entity name).
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/fraunces/600.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './app';
import { localeDatasetsPromise } from './app/locale-datasets';
import { initMonitoring } from './shared/lib/init-monitoring';
import './app/global.css';

initMonitoring();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('index.html is missing #root');
// The build-time prerender step (vite-plugins/prerender-default-viewport.ts)
// renders against an already-resolved dataset (App.tsx's `initialDatasets`),
// so App.tsx's own top-level Suspense boundary never actually suspends
// there. Hydrating before this promise settles would suspend on
// `use(localeDatasetsPromise)` (App.tsx) immediately, mismatching the
// server's already-resolved render and throwing a hydration error — waiting
// here instead just means hydration (attaching listeners) lands slightly
// after the data it needs anyway arrives, same as it always effectively
// depended on.
//
// The dev server never runs the prerender step (it's `apply: 'build'`
// only), so #root is genuinely empty there — hydrateRoot against nothing
// throws a hydration-mismatch error every load and falls back to a full
// client render anyway. Only hydrate when there's real prerendered markup
// to reconcile against; otherwise just render fresh, same outcome either
// way in prod.
localeDatasetsPromise.then(() => {
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, <App />);
  } else {
    createRoot(rootElement).render(<App />);
  }
});
