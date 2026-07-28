import type { ArchitectureEdge, ArchitectureGraph } from "../domain/architectureGraph.js";

const formatRelation = (edge: ArchitectureEdge): string =>
  `- ${edge.source} --${edge.kind}--> ${edge.target}`;

export const formatNodeInspection = (graph: ArchitectureGraph, nodeId: string): string => {
  const node = graph.findNode(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const incoming = graph.edges.filter((edge) => edge.target === nodeId);
  const outgoing = graph.edges.filter((edge) => edge.source === nodeId);

  return [
    `Node: ${node.id}`,
    `Kind: ${node.kind}`,
    node.sourceLocation
      ? `Source: ${node.sourceLocation.file}:${node.sourceLocation.line}`
      : "Source: unavailable",
    "",
    "Incoming relations:",
    ...(incoming.length > 0 ? incoming.map(formatRelation) : ["- none"]),
    "",
    "Outgoing relations:",
    ...(outgoing.length > 0 ? outgoing.map(formatRelation) : ["- none"]),
  ].join("\n");
};
