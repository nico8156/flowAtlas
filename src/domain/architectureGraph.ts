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
      if (edge.kind === "LISTENS_TO") {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        const targetNode = nodes.find((node) => node.id === edge.target);

        if (sourceNode?.kind !== "Handler" || targetNode?.kind !== "Event") {
          throw new Error("LISTENS_TO requires a Handler source and Event target");
        }
      }

      edges.push(edge);
    },
  };
};
