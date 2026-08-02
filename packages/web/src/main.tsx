import { createRoot } from 'react-dom/client';
import { App } from './app';
import './app/global.css';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- index.html always provides #root
createRoot(document.getElementById('root')!).render(<App />);
