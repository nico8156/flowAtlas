import { createRoot } from "react-dom/client";

import { VisualizerApp } from "./VisualizerApp.js";

const root = document.getElementById("root");

if (!root) {
  throw new Error("FlowAtlas visualizer root element is missing");
}

createRoot(root).render(<VisualizerApp />);
