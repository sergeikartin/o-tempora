import '@fontsource/archivo/400.css';
import '@fontsource/fraunces/600.css';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { LandingPage } from './app/landing';
import { initMonitoring } from './shared/lib/init-monitoring';
import './app/global.css';

initMonitoring();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('landing index.html is missing #root');
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, <LandingPage />);
} else {
  createRoot(rootElement).render(<LandingPage />);
}
