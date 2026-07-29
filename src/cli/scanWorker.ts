import { parentPort, workerData } from "node:worker_threads";

import { serializeArchitectureGraph } from "../application/architectureGraphJson.js";
import { loadTypeScriptProject } from "./projectLoader.js";
import { scanTypeScriptProject } from "../scanner/typeScriptScanner.js";

type ScanWorkerMessage =
  | { readonly type: "graph"; readonly json: string }
  | { readonly type: "error"; readonly message: string };

if (!parentPort) {
  throw new Error("FlowAtlas scan worker requires a parent port");
}

const projectPath = workerData as string;

try {
  const loadedProject = await loadTypeScriptProject(projectPath);
  const graph = scanTypeScriptProject(loadedProject.project);
  const message: ScanWorkerMessage = {
    type: "graph",
    json: serializeArchitectureGraph(graph),
  };
  parentPort.postMessage(message);
} catch (error: unknown) {
  const message: ScanWorkerMessage = {
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  };
  parentPort.postMessage(message);
}
