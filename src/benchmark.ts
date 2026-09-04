#!/usr/bin/env node

import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { runVerifiedSnapshotBenchmark } from "./benchmark/verifiedSnapshotBenchmark.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const argumentsAfterExecutable = process.argv.slice(2);
const projectPath = argumentsAfterExecutable.find((argument) => !argument.startsWith("--"));
const iterationsArgument = argumentsAfterExecutable.find((argument) =>
  argument.startsWith("--iterations="),
);
const iterations = Number(iterationsArgument?.split("=")[1] ?? 5);

if (!projectPath) {
  process.stderr.write("Usage: flowatlas-benchmark <project-path> [--iterations=5]\n");
  process.exitCode = 1;
} else {
  runVerifiedSnapshotBenchmark({
    projectPath,
    iterations,
    loadProject: loadTypeScriptProject,
    scanProject: scanTypeScriptProject,
  })
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`FlowAtlas benchmark: ${message}\n`);
      process.exitCode = 1;
    });
}
