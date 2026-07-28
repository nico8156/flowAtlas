import {
  projectDownstream,
  projectUpstream,
  type GraphProjection,
} from "../domain/graphProjection.js";
import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureEdge,
} from "../domain/architectureGraph.js";

const edgeKey = (edge: ArchitectureEdge): string =>
  `${edge.source}\u0000${edge.kind}\u0000${edge.target}`;

export const projectFocusedTerritory = (
  graph: ArchitectureGraph,
  focusNodeId: string,
  maxDepth = 2,
): GraphProjection => {
  const projections = [
    projectDownstream(graph, focusNodeId, { maxDepth }),
    projectUpstream(graph, focusNodeId, { maxDepth }),
  ];
  const nodes = new Map<string, ArchitectureNode>();
  const edges = new Map<string, ArchitectureEdge>();

  for (const projection of projections) {
    for (const node of projection.nodes) nodes.set(node.id, node);
    for (const edge of projection.edges) edges.set(edgeKey(edge), edge);
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
};
