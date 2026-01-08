import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 📱 PWA: Controllo se già installata
if ('serviceWorker' in navigator) {
  // Controlla se l'app è già installata
  const isInstalled = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIOSInstalled = (window.navigator as any).standalone === true;
  
  if (isInstalled || isIOSInstalled) {
    console.log('📱 App già installata come PWA');
    document.body.classList.add('pwa-installed');
  } else {
    console.log('📱 App in modalità browser');
    document.body.classList.add('pwa-browser');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);