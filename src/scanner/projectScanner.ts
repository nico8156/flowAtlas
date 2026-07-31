import { performance } from "node:perf_hooks";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import { resolveProjectSymbols, type TypeScriptProject } from "./projectSymbolResolver.js";
import { getStoreStateIds } from "./stateDetector.js";
import { scanSourceIntoGraph } from "./sourceScanner.js";

export const scanTypeScriptProject = (project: TypeScriptProject): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const resolution = resolveProjectSymbols(project);
  const startedStateDiscovery = performance.now();
  const stateIds = getStoreStateIds(project, resolution.bindingsByFile);
  project.onScanPhase?.({
    phase: "state-discovery",
    durationMs: performance.now() - startedStateDiscovery,
  });
  for (const collectRelationships of [false, true]) {
    const phase = collectRelationships ? "relationship-pass" : "discovery-pass";
    const startedAt = performance.now();
    try {
      for (const file of project.files) {
        scanSourceIntoGraph(
          file,
          graph,
          resolution.bindingsByFile.get(file.file) ?? new Map(),
          resolution.eventIds,
          stateIds,
          collectRelationships,
          resolution.sourceFiles.map(({ sourceFile }) => sourceFile),
          resolution.semanticIndex,
          resolution.sourceFiles.find((source) => source.file === file.file)?.sourceFile,
        );
      }
    } finally {
      project.onScanPhase?.({ phase, durationMs: performance.now() - startedAt });
    }
  }

  return graph;
};
