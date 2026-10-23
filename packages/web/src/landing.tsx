import '@fontsource/archivo/400.css';
import '@fontsource/fraunces/600.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { LandingPage } from './app/landing';
import { initMonitoring } from './shared/lib/init-monitoring';
import './app/global.css';

initMonitoring();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('landing index.html is missing #root');
// Same prerendered-or-fresh split as main.tsx: the build prerenders the
// landing markup (vite-plugins/prerender-default-viewport.ts), the dev server
// doesn't.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <LandingPage />);
} else {
  createRoot(rootElement).render(<LandingPage />);
}
