import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import { resolveProjectSymbols, type TypeScriptProject } from "./projectSymbolResolver.js";
import { getStoreStateIds } from "./stateDetector.js";
import { scanSourceIntoGraph } from "./sourceScanner.js";

export const scanTypeScriptProject = (project: TypeScriptProject): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const resolution = resolveProjectSymbols(project);
  const stateIds = getStoreStateIds(project, resolution.bindingsByFile);
  for (const collectRelationships of [false, true]) {
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
      );
    }
  }

  return graph;
};
