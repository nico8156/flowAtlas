import {
  type ArchitectureEdge,
  type ArchitectureGraph,
  type ArchitectureNode,
} from "./architectureGraph.js";

export type GraphProjection = {
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
};

export type GraphProjectionOptions = {
  maxDepth?: number;
};

const downstreamTarget = (edge: ArchitectureEdge, nodeId: string): string | undefined => {
  if (edge.kind === "LISTENS_TO") {
    return edge.target === nodeId ? edge.source : undefined;
  }

  return edge.source === nodeId ? edge.target : undefined;
};

const upstreamTarget = (edge: ArchitectureEdge, nodeId: string): string | undefined => {
  if (edge.kind === "LISTENS_TO") {
    return edge.source === nodeId ? edge.target : undefined;
  }

  return edge.target === nodeId ? edge.source : undefined;
};

const project = (
  graph: ArchitectureGraph,
  focusNodeId: string,
  nextNode: (edge: ArchitectureEdge, nodeId: string) => string | undefined,
  { maxDepth = Number.POSITIVE_INFINITY }: GraphProjectionOptions = {},
): GraphProjection => {
  const includedNodeIds = new Set<string>([focusNodeId]);
  const pendingNodeIds = [{ id: focusNodeId, depth: 0 }];

  while (pendingNodeIds.length > 0) {
    const current = pendingNodeIds.shift();
    if (!current || current.depth >= maxDepth) continue;

    for (const edge of graph.edges) {
      const nextNodeId = nextNode(edge, current.id);
      if (!nextNodeId || includedNodeIds.has(nextNodeId)) continue;

      includedNodeIds.add(nextNodeId);
      pendingNodeIds.push({ id: nextNodeId, depth: current.depth + 1 });
    }
  }

  return {
    nodes: graph.nodes.filter((node) => includedNodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target),
    ),
  };
};

export const projectDownstream = (
  graph: ArchitectureGraph,
  focusNodeId: string,
  options?: GraphProjectionOptions,
): GraphProjection => project(graph, focusNodeId, downstreamTarget, options);

export const projectUpstream = (
  graph: ArchitectureGraph,
  focusNodeId: string,
  options?: GraphProjectionOptions,
): GraphProjection => project(graph, focusNodeId, upstreamTarget, options);
