import { createRoot } from 'react-dom/client';
import { MentraProvider } from '@mentra/miniapp/react';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <MentraProvider>
    <App />
  </MentraProvider>,
);
