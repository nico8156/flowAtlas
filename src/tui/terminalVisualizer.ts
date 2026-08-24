import type { ArchitectureEdge, ArchitectureNode } from "../domain/architectureGraph.js";
import type { GraphProjection } from "../domain/graphProjection.js";
import type { NodeKind } from "../domain/architectureGraph.js";

type TerminalVisualizerSession = {
  search(query: string): void;
  select(nodeId: string): void;
  render(): string;
};

export type TerminalView = {
  readonly visibleNodes: readonly ArchitectureNode[];
  readonly mapLines: readonly string[];
  readonly inspector: {
    readonly node?: ArchitectureNode;
    readonly incoming: readonly string[];
    readonly outgoing: readonly string[];
  };
};

export const filterTerminalProjection = (
  projection: GraphProjection,
  nodeKinds: readonly NodeKind[],
): GraphProjection => {
  const visibleNodeIds = new Set(
    projection.nodes.filter((node) => nodeKinds.includes(node.kind)).map((node) => node.id),
  );
  const seenEdges = new Set<string>();

  return {
    nodes: projection.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: projection.edges.filter((edge) => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false;
      const identity = `${edge.source}\u0000${edge.kind}\u0000${edge.target}`;
      if (seenEdges.has(identity)) return false;
      seenEdges.add(identity);
      return true;
    }),
  };
};

const formatNode = (node: ArchitectureNode, selected: boolean): string =>
  `${selected ? ">" : " "} [${node.kind === "External" ? "X" : node.kind[0]}] ${node.id}`;

const formatEdge = (edge: ArchitectureEdge): string =>
  `${edge.source} --${edge.kind}--> ${edge.target}`;

const visualEdge = (edge: ArchitectureEdge): { source: string; target: string } =>
  edge.kind === "LISTENS_TO"
    ? { source: edge.target, target: edge.source }
    : { source: edge.source, target: edge.target };

const relationLines = (
  projection: GraphProjection,
  nodeId: string,
  direction: "incoming" | "outgoing",
): string[] =>
  projection.edges
    .filter((edge) => {
      const rendered = visualEdge(edge);
      return direction === "incoming" ? rendered.target === nodeId : rendered.source === nodeId;
    })
    .map(formatEdge);

export const buildTerminalView = (
  projection: GraphProjection,
  selectedNodeId: string | undefined,
  query = "",
): TerminalView => {
  const visibleNodes = projection.nodes.filter((node) =>
    node.id.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedNode = projection.nodes.find((node) => node.id === selectedNodeId);

  return {
    visibleNodes,
    mapLines: projection.edges.map(formatEdge),
    inspector: {
      ...(selectedNode ? { node: selectedNode } : {}),
      incoming: selectedNode ? relationLines(projection, selectedNode.id, "incoming") : ["- none"],
      outgoing: selectedNode ? relationLines(projection, selectedNode.id, "outgoing") : ["- none"],
    },
  };
};

export const createTerminalVisualizerSession = (
  projection: GraphProjection,
): TerminalVisualizerSession => {
  let query = "";
  let selectedNodeId: string | undefined;

  return {
    search(nextQuery) {
      query = nextQuery;
    },
    select(nodeId) {
      if (projection.nodes.some((node) => node.id === nodeId)) {
        selectedNodeId = nodeId;
      }
    },
    render() {
      const view = buildTerminalView(projection, selectedNodeId, query);
      const selectedNode = view.inspector.node;

      return [
        "FlowAtlas · Terminal Map",
        "",
        "Explorer",
        ...view.visibleNodes.map((node) => formatNode(node, node.id === selectedNodeId)),
        "",
        "Map",
        ...view.mapLines,
        "",
        "Inspector",
        ...(selectedNode
          ? [
              selectedNode.id,
              `Kind: ${selectedNode.kind}`,
              selectedNode.sourceLocation
                ? `Source: ${selectedNode.sourceLocation.file}:${selectedNode.sourceLocation.line}`
                : "Source: unavailable",
              "",
              "Incoming",
              ...view.inspector.incoming,
              "",
              "Outgoing",
              ...view.inspector.outgoing,
            ]
          : ["No node selected"]),
      ].join("\n");
    },
  };
};
