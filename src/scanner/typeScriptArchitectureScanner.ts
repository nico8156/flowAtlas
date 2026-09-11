import type { ArchitectureScanner } from "../application/architectureScanner.js";
import type { ArchitectureGraph } from "../domain/architectureGraph.js";

type TypeScriptGraphLoader = (projectPath: string) => Promise<ArchitectureGraph>;

export const createTypeScriptArchitectureScanner = (
  loadGraph: TypeScriptGraphLoader,
): ArchitectureScanner => ({
  async scan({ projectPath }) {
    return { graph: await loadGraph(projectPath), diagnostics: [] };
  },
});
