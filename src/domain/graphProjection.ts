import {
  type ArchitectureEdge,
  type ArchitectureGraph,
  type ArchitectureNode,
} from "./architectureGraph.js";

export type GraphProjection = {
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly ArchitectureEdge[];
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
): GraphProjection => {
  const includedNodeIds = new Set<string>([focusNodeId]);
  const pendingNodeIds = [focusNodeId];

  while (pendingNodeIds.length > 0) {
    const currentNodeId = pendingNodeIds.shift();
    if (!currentNodeId) continue;

    for (const edge of graph.edges) {
      const nextNodeId = nextNode(edge, currentNodeId);
      if (!nextNodeId || includedNodeIds.has(nextNodeId)) continue;

      includedNodeIds.add(nextNodeId);
      pendingNodeIds.push(nextNodeId);
    }
  }

  return {
    nodes: graph.nodes.filter((node) => includedNodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target),
    ),
  };
};

export const projectDownstream = (graph: ArchitectureGraph, focusNodeId: string): GraphProjection =>
  project(graph, focusNodeId, downstreamTarget);

export const projectUpstream = (graph: ArchitectureGraph, focusNodeId: string): GraphProjection =>
  project(graph, focusNodeId, upstreamTarget);
