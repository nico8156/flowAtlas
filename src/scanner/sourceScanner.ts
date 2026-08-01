import * as ts from "typescript";
import { performance } from "node:perf_hooks";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import { detectEvents, getResolvedEventId } from "./eventDetector.js";
import { detectExternalNodes } from "./externalDetector.js";
import { detectListeners } from "./listenerDetector.js";
import { detectStates, type StateIds } from "./stateDetector.js";
import {
  type EventIds,
  type ProjectSymbolResolution,
  type ScanPhase,
  type SymbolBindings,
  type TypeScriptSource,
} from "./projectSymbolResolver.js";
import { createTypeScriptSourceFile } from "./typeScriptAst.js";

export const scanSourceIntoGraph = (
  { file, source }: TypeScriptSource,
  graph: ArchitectureGraph,
  bindings: SymbolBindings = new Map(),
  eventIds: EventIds = new Map(),
  stateIds: StateIds = new Map(),
  collectRelationships = true,
  sourceFiles: readonly ts.SourceFile[] = [
    createTypeScriptSourceFile("flowatlas-input.ts", source),
  ],
  semanticIndex?: ProjectSymbolResolution["semanticIndex"],
  compiledSourceFile?: ts.SourceFile,
  onDetectorPhase?: (phase: ScanPhase, durationMs: number) => void,
  externalResolutionCache?: Map<string, readonly string[]>,
): void => {
  const sourceFile = compiledSourceFile ?? createTypeScriptSourceFile(file, source);

  const measureDetector = (phase: ScanPhase, operation: () => void): void => {
    if (!onDetectorPhase) {
      operation();
      return;
    }
    const startedAt = performance.now();
    try {
      operation();
    } finally {
      onDetectorPhase(phase, performance.now() - startedAt);
    }
  };

  measureDetector("relationship-external-detection", () => detectExternalNodes(sourceFile, graph));
  measureDetector("relationship-event-detection", () =>
    detectEvents(sourceFile, file, graph, eventIds),
  );
  measureDetector("relationship-listener-detection", () =>
    detectListeners({
      sourceFile,
      graph,
      bindings,
      collectRelationships,
      sourceFiles,
      semanticIndex,
      ...(onDetectorPhase ? { onListenerPhase: onDetectorPhase } : {}),
      ...(externalResolutionCache ? { externalResolutionCache } : {}),
    }),
  );
  measureDetector("relationship-state-detection", () =>
    detectStates(
      sourceFile,
      graph,
      stateIds,
      (localName) => getResolvedEventId(graph, localName, bindings),
      collectRelationships,
    ),
  );
};

export const scanTypeScriptSource = (input: TypeScriptSource): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  scanSourceIntoGraph(input, graph);
  return graph;
};
