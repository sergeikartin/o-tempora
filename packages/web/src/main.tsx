import 'temporal-polyfill/global';
// Self-hosted at build time (no runtime network fetch) — weights match what
// docs/design-tokens.md's Typography table and the CSS below actually use.
// Archivo covers UI chrome, entry labels, and data (tabular-nums, no
// separate mono face); Fraunces is the display face, used sparingly
// (DetailPanel's entity name).
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/fraunces/600.css';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './app/global.css';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index.html always provides #root
createRoot(document.getElementById('root')!).render(<App />);
