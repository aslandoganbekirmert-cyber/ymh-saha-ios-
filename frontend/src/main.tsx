import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Web ortamında kamera vb. pluginlerin çalışması için gerekli
defineCustomElements(window);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
