import type { ArchitectureGraph, NodeKind } from "../domain/architectureGraph.js";

const nodeKinds: readonly NodeKind[] = ["Event", "Handler", "State", "External"];

export const formatArchitectureSummary = (
  projectName: string,
  fileCount: number,
  graph: ArchitectureGraph,
): string => {
  const counts = new Map<NodeKind, number>(nodeKinds.map((kind) => [kind, 0]));

  for (const node of graph.nodes) {
    counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
  }

  return [
    "FlowAtlas",
    "",
    `Project: ${projectName}`,
    `TypeScript files: ${fileCount}`,
    "",
    `Events: ${counts.get("Event") ?? 0}`,
    `Handlers: ${counts.get("Handler") ?? 0}`,
    `States: ${counts.get("State") ?? 0}`,
    `Externals: ${counts.get("External") ?? 0}`,
    `Relations: ${graph.edges.length}`,
    "",
    "Scan completed.",
  ].join("\n");
};
