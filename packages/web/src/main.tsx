import 'temporal-polyfill/global';
// Self-hosted at build time (no runtime network fetch) — weights match what
// docs/design-tokens.md's Typography table and the CSS below actually use.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './app/global.css';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index.html always provides #root
createRoot(document.getElementById('root')!).render(<App />);
