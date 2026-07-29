import { Worker } from "node:worker_threads";

import { deserializeArchitectureGraph } from "../application/architectureGraphJson.js";
import type { ArchitectureGraph } from "../domain/architectureGraph.js";

type ScanWorkerMessage =
  | { readonly type: "graph"; readonly json: string }
  | { readonly type: "error"; readonly message: string };

export type ScanWorkerTask = {
  readonly promise: Promise<ArchitectureGraph>;
  readonly cancel: () => void;
};

export const startScanProjectInWorker = (projectPath: string): ScanWorkerTask => {
  const worker = new Worker(new URL("./cli/scanWorker.js", import.meta.url), {
    workerData: projectPath,
  });
  let settled = false;
  let rejectTask: ((error: unknown) => void) | undefined;

  const promise = new Promise<ArchitectureGraph>((resolve, reject) => {
    rejectTask = reject;
    worker.once("message", (message: ScanWorkerMessage) => {
      if (message.type === "error") {
        settled = true;
        reject(new Error(message.message));
        return;
      }

      try {
        settled = true;
        resolve(deserializeArchitectureGraph(message.json));
      } catch (error: unknown) {
        settled = true;
        reject(error);
      }
    });
    worker.once("error", (error) => {
      settled = true;
      reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        reject(new Error(`Scan worker exited with code ${code}`));
      }
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      rejectTask?.(new Error("Scan cancelled"));
      void worker.terminate();
    },
  };
};
