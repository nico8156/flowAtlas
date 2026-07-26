export type RelationKind =
  | "LISTENS_TO"
  | "DISPATCHES"
  | "UPDATES"
  | "CALLS_EXTERNAL";

export type NodeKind = "Event" | "Handler" | "State" | "External";

export type ArchitectureNode = {
  id: string;
  kind: NodeKind;
};

export type ArchitectureEdge = {
  source: string;
  target: string;
  kind: RelationKind;
};

export type ArchitectureGraph = {
  nodes: readonly ArchitectureNode[];
  edges: readonly ArchitectureEdge[];
  addNode(node: ArchitectureNode): void;
  addEdge(edge: ArchitectureEdge): void;
};

export const createArchitectureGraph = (): ArchitectureGraph => {
  const nodes: ArchitectureNode[] = [];
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
