export type RelationKind =
  | "LISTENS_TO"
  | "DISPATCHES"
  | "UPDATES"
  | "CALLS_EXTERNAL";

export type ArchitectureEdge = {
  source: string;
  target: string;
  kind: RelationKind;
};

export type ArchitectureGraph = {
  nodes: readonly unknown[];
  edges: readonly ArchitectureEdge[];
  addNode(node: unknown): void;
  addEdge(edge: ArchitectureEdge): void;
};

export const createArchitectureGraph = (): ArchitectureGraph => {
  const nodes: unknown[] = [];
  const edges: ArchitectureEdge[] = [];

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
