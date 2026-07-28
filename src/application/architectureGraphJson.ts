import {
  createArchitectureGraph,
  type ArchitectureEdge,
  type ArchitectureGraph,
  type ArchitectureNode,
} from "../domain/architectureGraph.js";

export const serializeArchitectureGraph = (graph: ArchitectureGraph): string =>
  JSON.stringify({ nodes: graph.nodes, edges: graph.edges }, null, 2);

export const deserializeArchitectureGraph = (json: string): ArchitectureGraph => {
  const data = JSON.parse(json) as {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  const graph = createArchitectureGraph();

  for (const node of data.nodes) {
    graph.addNode(node);
  }

  for (const edge of data.edges) {
    graph.addEdge(edge);
  }

  return graph;
};
