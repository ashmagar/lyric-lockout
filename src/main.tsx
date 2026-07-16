import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { createAppRouter } from './app/router';
import { bootstrapTheme } from './store/settingsStore';
import './styles/global.css';

bootstrapTheme();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to start Lyric Lockout: the root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
