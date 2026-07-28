import type { ArchitectureNode, NodeKind } from "../domain/architectureGraph.js";
import type { GraphProjection } from "../domain/graphProjection.js";

const colors: Record<NodeKind, string> = {
  Event: "34",
  Handler: "35",
  State: "32",
  External: "33",
};

const formatNode = (node: ArchitectureNode, useColor: boolean): string => {
  const label = `[${node.kind}] ${node.id}`;
  return useColor ? `\u001b[${colors[node.kind]}m${label}\u001b[0m` : label;
};

export const formatTerminalMap = (
  focusNodeId: string,
  projection: GraphProjection,
  useColor = false,
): string => {
  const focusNode = projection.nodes.find((node) => node.id === focusNodeId);
  const otherNodes = projection.nodes.filter((node) => node.id !== focusNodeId);
  const nodes = focusNode ? [focusNode, ...otherNodes] : otherNodes;

  return [
    "FlowAtlas",
    `Focus: ${focusNodeId}`,
    "",
    "Nodes:",
    ...nodes.map((node) => `  ${formatNode(node, useColor)}`),
    "",
    "Relations:",
    ...(projection.edges.length > 0
      ? projection.edges.map((edge) => `  ${edge.source} --${edge.kind}--> ${edge.target}`)
      : ["  - none"]),
  ].join("\n");
};
