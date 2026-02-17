import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ConsentBanner from './components/ConsentBanner.jsx'
import GtmPageviewListener from './GtmPageviewListener.jsx'
import './index.css'
import { HelmetProvider } from 'react-helmet-async'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
     <HelmetProvider>
    <BrowserRouter>
      <GtmPageviewListener />
      <App />
    </BrowserRouter>
    <ConsentBanner />
    </HelmetProvider>
  </React.StrictMode>
)
