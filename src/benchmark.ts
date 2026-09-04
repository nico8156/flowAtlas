#!/usr/bin/env node

import { loadTypeScriptProject } from "./cli/projectLoader.js";
import {
  createMetadataVerifiedProjectLoader,
  inspectTypeScriptProjectManifest,
  updateTypeScriptProjectFromManifest,
} from "./cli/metadataVerifiedProjectLoader.js";
import { runProgramReuseBenchmark } from "./benchmark/programReuseBenchmark.js";
import { runVerifiedSnapshotBenchmark } from "./benchmark/verifiedSnapshotBenchmark.js";
import { createProgramReusingProjectScanner } from "./mcp/programReusingProjectScanner.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const argumentsAfterExecutable = process.argv.slice(2);
const projectPath = argumentsAfterExecutable.find((argument) => !argument.startsWith("--"));
const iterationsArgument = argumentsAfterExecutable.find((argument) =>
  argument.startsWith("--iterations="),
);
const iterations = Number(iterationsArgument?.split("=")[1] ?? 5);
const verificationArgument = argumentsAfterExecutable.find((argument) =>
  argument.startsWith("--verification="),
);
const verification = verificationArgument?.split("=")[1] ?? "content";
const changedFile = argumentsAfterExecutable
  .find((argument) => argument.startsWith("--program-reuse-file="))
  ?.split("=")[1];

if (!projectPath || (verification !== "content" && verification !== "metadata")) {
  process.stderr.write(
    "Usage: flowatlas-benchmark <project-path> [--iterations=5] [--verification=content|metadata] [--program-reuse-file=path]\n",
  );
  process.exitCode = 1;
} else {
  const projectLoader =
    verification === "metadata"
      ? createMetadataVerifiedProjectLoader({
          inspectManifest: inspectTypeScriptProjectManifest,
          loadProject: loadTypeScriptProject,
          updateProject: updateTypeScriptProjectFromManifest,
        })
      : loadTypeScriptProject;
  const programReusingScanner = createProgramReusingProjectScanner({ maxPrograms: 4 });
  const benchmark = changedFile
    ? runProgramReuseBenchmark({
        projectPath,
        changedFile,
        loadProject: loadTypeScriptProject,
        reusedScan: programReusingScanner,
        coldScan: scanTypeScriptProject,
      })
    : runVerifiedSnapshotBenchmark({
        projectPath,
        iterations,
        verification,
        loadProject: projectLoader,
        scanProject: programReusingScanner,
      });
  benchmark
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`FlowAtlas benchmark: ${message}\n`);
      process.exitCode = 1;
    });
}
