// Self-host the fonts so first paint does not depend on a third-party request.
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
// The prerender has data already. Wait for the client data to avoid suspending
// during hydration and mismatching that markup. An empty root needs a fresh render.
localeDatasetsPromise.then(() => {
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, <App />);
  } else {
    createRoot(rootElement).render(<App />);
  }
});
