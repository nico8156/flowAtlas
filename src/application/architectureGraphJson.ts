import type { ArchitectureGraph } from "../domain/architectureGraph.js";

export const serializeArchitectureGraph = (graph: ArchitectureGraph): string =>
  JSON.stringify({ nodes: graph.nodes, edges: graph.edges }, null, 2);
