import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";
import { resolveProjectSymbols, type TypeScriptProject } from "./projectSymbolResolver.js";
import { getStoreStateIds } from "./stateDetector.js";
import { createTypeScriptSourceFile } from "./typeScriptAst.js";
import { scanSourceIntoGraph } from "./sourceScanner.js";

export const scanTypeScriptProject = (project: TypeScriptProject): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const resolution = resolveProjectSymbols(project);
  const stateIds = getStoreStateIds(project, resolution.bindingsByFile);
  const sourceFiles = project.files.map(({ file, source }) =>
    createTypeScriptSourceFile(file, source),
  );

  for (const collectRelationships of [false, true]) {
    for (const file of project.files) {
      scanSourceIntoGraph(
        file,
        graph,
        resolution.bindingsByFile.get(file.file) ?? new Map(),
        resolution.eventIds,
        stateIds,
        collectRelationships,
        sourceFiles,
      );
    }
  }

  return graph;
};
