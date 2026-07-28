import type { GraphProjection } from "../domain/graphProjection.js";

const formatNode = (node: GraphProjection["nodes"][number]): string =>
  `- ${node.id} (${node.kind})`;

const formatEdge = (edge: GraphProjection["edges"][number]): string =>
  `- ${edge.source} --${edge.kind}--> ${edge.target}`;

export const formatGraphProjection = (focusNodeId: string, projection: GraphProjection): string =>
  [
    `Focus: ${focusNodeId}`,
    "",
    "Nodes:",
    ...projection.nodes.map(formatNode),
    "",
    "Relations:",
    ...(projection.edges.length > 0 ? projection.edges.map(formatEdge) : ["- none"]),
  ].join("\n");
