import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { registerServiceWorker } from "./shared/pwa/registerServiceWorker.js";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);
registerServiceWorker();
