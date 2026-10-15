// React
import React from 'react'
import ReactDOM from "react-dom/client";

// AA bpforge
// App
import App from '@/App.tsx';
// Configuration
import { AppName } from "@/configuration.js"
import '@/index.css';

const container = document.getElementById(`${AppName}-root`)

if (!container) {
  throw new Error(`${AppName} React mount point was not found.`)
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
