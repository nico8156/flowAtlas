import * as ts from "typescript";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import { detectEvents, getResolvedEventId } from "./eventDetector.js";
import { detectExternalNodes } from "./externalDetector.js";
import { detectListeners } from "./listenerDetector.js";
import { detectStates, type StateIds } from "./stateDetector.js";
import {
  type EventIds,
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
): void => {
  const sourceFile = createTypeScriptSourceFile("flowatlas-input.ts", source);

  detectExternalNodes(sourceFile, graph);
  detectEvents(sourceFile, file, graph, eventIds);
  detectListeners({
    sourceFile,
    graph,
    bindings,
    collectRelationships,
    sourceFiles,
  });
  detectStates(
    sourceFile,
    graph,
    stateIds,
    (localName) => getResolvedEventId(graph, localName, bindings),
    collectRelationships,
  );
};

export const scanTypeScriptSource = (input: TypeScriptSource): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  scanSourceIntoGraph(input, graph);
  return graph;
};
