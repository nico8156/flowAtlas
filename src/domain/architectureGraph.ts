export type RelationKind =
  | "LISTENS_TO"
  | "DISPATCHES"
  | "UPDATES"
  | "CALLS_EXTERNAL";

export type NodeKind = "Event" | "Handler" | "State" | "External";

export type ArchitectureNode = {
  id: string;
  kind: NodeKind;
  sourceLocation?: SourceLocation;
};

export type SourceLocation = {
  file: string;
  line: number;
};

export type ArchitectureEdge = {
  source: string;
  target: string;
  kind: RelationKind;
  sourceLocation?: SourceLocation;
};

export type ArchitectureGraph = {
  nodes: readonly ArchitectureNode[];
  edges: readonly ArchitectureEdge[];
  addNode(node: ArchitectureNode): void;
  addEdge(edge: ArchitectureEdge): void;
  downstream(nodeId: string): readonly ArchitectureNode[];
  upstream(nodeId: string): readonly ArchitectureNode[];
};

const relationNodeKinds: Record<RelationKind, {
  source: NodeKind;
  target: NodeKind;
  description: string;
}> = {
  LISTENS_TO: {
    source: "Handler",
    target: "Event",
    description: "a Handler source and Event target",
  },
  DISPATCHES: {
    source: "Handler",
    target: "Event",
    description: "a Handler source and Event target",
  },
  UPDATES: {
    source: "Event",
    target: "State",
    description: "an Event source and State target",
  },
  CALLS_EXTERNAL: {
    source: "Handler",
    target: "External",
    description: "a Handler source and External target",
  },
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
      const expected = relationNodeKinds[edge.kind];
      const sourceNode = nodes.find((node) => node.id === edge.source);
      const targetNode = nodes.find((node) => node.id === edge.target);

      if (sourceNode?.kind !== expected.source || targetNode?.kind !== expected.target) {
        throw new Error(`${edge.kind} requires ${expected.description}`);
      }

      edges.push(edge);
    },
    downstream(nodeId) {
      const downstreamNodes: ArchitectureNode[] = [];

      for (const edge of edges) {
        if (edge.source !== nodeId) {
          continue;
        }

        const targetNode = nodes.find((node) => node.id === edge.target);
        if (targetNode) {
          downstreamNodes.push(targetNode);
        }
      }

      return downstreamNodes;
    },
    upstream(nodeId) {
      const upstreamNodes: ArchitectureNode[] = [];

      for (const edge of edges) {
        if (edge.target !== nodeId) {
          continue;
        }

        const sourceNode = nodes.find((node) => node.id === edge.source);
        if (sourceNode) {
          upstreamNodes.push(sourceNode);
        }
      }

      return upstreamNodes;
    },
  };
};
