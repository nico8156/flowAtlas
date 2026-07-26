export type ArchitectureGraph = {
  nodes: readonly unknown[];
  edges: readonly unknown[];
  addNode(node: unknown): void;
};

export const createArchitectureGraph = (): ArchitectureGraph => {
  const nodes: unknown[] = [];

  return {
    nodes,
    edges: [],
    addNode(node) {
      nodes.push(node);
    },
  };
};
