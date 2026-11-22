// React
import React from 'react'
import ReactDOM from "react-dom/client";

// Third Party
import { initI18n } from "aa-geuthur-react";

// AA bpforge
import { AppName, ProjectName } from "@/constants";
import Routing from "@/Routing";

// Styles
import '@/Styles/index.css';

initI18n(ProjectName, `${AppName}-root`);

const container = document.getElementById(`${AppName}-root`)

if (!container) {
  throw new Error(`${AppName} React mount point was not found.`)
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Routing />
  </React.StrictMode>,
)
