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
      if (nodes.some((existingNode) => existingNode.id === node.id)) {
        return;
      }

      nodes.push(node);
    },
    addEdge(edge) {
      if (
        edge.kind === "LISTENS_TO" ||
        edge.kind === "DISPATCHES" ||
        edge.kind === "UPDATES" ||
        edge.kind === "CALLS_EXTERNAL"
      ) {
        const sourceNode = nodes.find((node) => node.id === edge.source);
        const targetNode = nodes.find((node) => node.id === edge.target);

        const validNodeKinds = (() => {
          switch (edge.kind) {
            case "UPDATES":
              return sourceNode?.kind === "Event" && targetNode?.kind === "State";
            case "CALLS_EXTERNAL":
              return sourceNode?.kind === "Handler" && targetNode?.kind === "External";
            default:
              return sourceNode?.kind === "Handler" && targetNode?.kind === "Event";
          }
        })();

        if (!validNodeKinds) {
          const expected = (() => {
            switch (edge.kind) {
              case "UPDATES":
                return "Event source and State target";
              case "CALLS_EXTERNAL":
                return "Handler source and External target";
              default:
                return "Handler source and Event target";
            }
          })();
          throw new Error(`${edge.kind} requires an ${expected}`);
        }
      }

      edges.push(edge);
    },
  };
};
