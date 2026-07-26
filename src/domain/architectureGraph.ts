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
      if (
        edge.kind === "LISTENS_TO" ||
        edge.kind === "DISPATCHES" ||
        edge.kind === "UPDATES"
      ) {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        const targetNode = nodes.find((node) => node.id === edge.target);

        const validNodeKinds =
          edge.kind === "UPDATES"
            ? sourceNode?.kind === "Event" && targetNode?.kind === "State"
            : sourceNode?.kind === "Handler" && targetNode?.kind === "Event";

        if (!validNodeKinds) {
          const expected =
            edge.kind === "UPDATES" ? "Event source and State target" : "Handler source and Event target";
          throw new Error(`${edge.kind} requires an ${expected}`);
        }
      }

      edges.push(edge);
    },
  };
};
