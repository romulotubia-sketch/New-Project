import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (
  typeof window !== 'undefined' &&
  !(window as unknown as {__SOUL_ROGUE_STANDALONE__?: boolean}).__SOUL_ROGUE_STANDALONE__ &&
  (window.location.protocol === 'http:' || window.location.protocol === 'https:')
) {
  try {
    registerSW({immediate: true});
  } catch {
    // Ignore SW registration errors in restricted contexts
  }
}

createRoot(document.getElementById('root')!).render(<App />);
