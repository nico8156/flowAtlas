import { performance } from "node:perf_hooks";
import type * as ts from "typescript";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import {
  resolveProjectSymbols,
  type ScanPhase,
  type TypeScriptProject,
} from "./projectSymbolResolver.js";
import { getStoreStateIds } from "./stateDetector.js";
import { scanSourceIntoGraph } from "./sourceScanner.js";

export type ProjectScanOptions = {
  oldProgram?: ts.Program;
  onProgramBuilt?: (program: ts.Program) => void;
};

export const scanTypeScriptProject = (
  project: TypeScriptProject,
  options: ProjectScanOptions = {},
): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const resolution = resolveProjectSymbols(project, options.oldProgram);
  options.onProgramBuilt?.(resolution.program);
  const externalResolutionCache = new Map<string, readonly string[]>();
  const startedStateDiscovery = performance.now();
  const stateIds = getStoreStateIds(project, resolution.bindingsByFile);
  project.onScanPhase?.({
    phase: "state-discovery",
    durationMs: performance.now() - startedStateDiscovery,
  });
  for (const collectRelationships of [false, true]) {
    const phase = collectRelationships ? "relationship-pass" : "discovery-pass";
    const startedAt = performance.now();
    const detectorDurations = new Map<ScanPhase, number>();
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
          resolution.checker,
          collectRelationships
            ? (detectorPhase, durationMs) => {
                detectorDurations.set(
                  detectorPhase,
                  (detectorDurations.get(detectorPhase) ?? 0) + durationMs,
                );
              }
            : undefined,
          externalResolutionCache,
        );
      }
    } finally {
      if (collectRelationships) {
        for (const detectorPhase of [
          "relationship-external-detection",
          "relationship-event-detection",
          "relationship-listener-detection",
          "relationship-state-detection",
          "listener-discovery",
          "listener-infrastructure",
          "listener-dispatch",
          "listener-external",
          "listener-thunk",
        ] as const) {
          project.onScanPhase?.({
            phase: detectorPhase,
            durationMs: detectorDurations.get(detectorPhase) ?? 0,
          });
        }
      }
      project.onScanPhase?.({ phase, durationMs: performance.now() - startedAt });
    }
  }

  return graph;
};
