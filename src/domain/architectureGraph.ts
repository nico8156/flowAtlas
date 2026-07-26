export type ArchitectureGraph = {
  nodes: readonly unknown[];
  edges: readonly { source: string; target: string }[];
  addNode(node: unknown): void;
  addEdge(edge: { source: string; target: string }): void;
};

export const createArchitectureGraph = (): ArchitectureGraph => {
  const nodes: unknown[] = [];
  const edges: { source: string; target: string }[] = [];

  return {
    nodes,
    edges,
    addNode(node) {
      nodes.push(node);
    },
    addEdge(edge) {
      edges.push(edge);
    },
  };
};
