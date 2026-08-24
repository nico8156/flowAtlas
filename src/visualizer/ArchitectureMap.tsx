import { useMemo, useState } from "react";
import {
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react";
import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  NodeKind,
} from "../domain/architectureGraph.js";
import {
  projectDownstream,
  projectUpstream,
  type GraphProjection,
} from "../domain/graphProjection.js";
import "@xyflow/react/dist/style.css";
import "./ArchitectureMap.css";

type ArchitectureNodeData = {
  node: ArchitectureNode;
};

type ArchitectureFlowNode = FlowNode<ArchitectureNodeData, "architecture">;

const nodeKindStyles: Record<NodeKind, { borderColor: string; backgroundColor: string }> = {
  Event: { borderColor: "#2f80ed", backgroundColor: "#eaf3ff" },
  Handler: { borderColor: "#9b51e0", backgroundColor: "#f5edff" },
  State: { borderColor: "#27ae60", backgroundColor: "#eaf8ef" },
  External: { borderColor: "#f2994a", backgroundColor: "#fff3e8" },
};

const nodeKindClass = (kind: NodeKind): string => `architecture-node-${kind.toLowerCase()}`;
const defaultFocusDepth = 2;
const createProjectionOptions = (maxDepth: number | undefined) =>
  maxDepth === undefined ? undefined : { maxDepth };

const nodeTypes = {
  architecture: ({ data }: NodeProps<ArchitectureFlowNode>) => (
    <>
      <Handle type="target" position={Position.Left} />
      <button
        type="button"
        aria-label={data.node.id}
        className={`architecture-node ${nodeKindClass(data.node.kind)}`}
        data-node-kind={data.node.kind}
        style={nodeKindStyles[data.node.kind]}
      >
        {data.node.id}
      </button>
      <Handle type="source" position={Position.Right} />
    </>
  ),
};

export const layoutArchitectureNodes = (
  nodes: readonly ArchitectureNode[],
  edges: readonly ArchitectureEdge[],
  focusNodeId?: string,
): ArchitectureFlowNode[] => {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));

  if (focusNodeId && nodes.some((node) => node.id === focusNodeId)) {
    const distances = new Map<string, number>([[focusNodeId, 0]]);
    const pending = [focusNodeId];

    while (pending.length > 0) {
      const current = pending.shift();
      if (!current) continue;

      for (const edge of edges) {
        const next =
          edge.source === current ? edge.target : edge.target === current ? edge.source : undefined;
        if (!next || distances.has(next)) continue;

        distances.set(next, (distances.get(current) ?? 0) + 1);
        pending.push(next);
      }
    }

    const maxDistance = Math.max(...distances.values());
    const levels = new Map<number, string[]>();
    for (const node of nodes) {
      const distance = distances.get(node.id) ?? maxDistance + 1;
      const level = levels.get(distance) ?? [];
      level.push(node.id);
      levels.set(distance, level);
    }

    for (const [distance, nodeIds] of levels) {
      nodeIds.sort((first, second) => (nodeOrder.get(first) ?? 0) - (nodeOrder.get(second) ?? 0));
      nodeIds.forEach((nodeId, index) => {
        positions.set(nodeId, { x: distance * 280, y: index * 120 });
      });
    }
  } else {
    nodes.forEach((node, index) => {
      positions.set(node.id, { x: (index % 3) * 280, y: Math.floor(index / 3) * 120 });
    });
  }

  return nodes.map((node) => ({
    id: node.id,
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: { node },
    type: "architecture",
  }));
};

export const createVisualEdge = (edge: ArchitectureEdge, index: number): FlowEdge => {
  const source = edge.kind === "LISTENS_TO" ? edge.target : edge.source;
  const target = edge.kind === "LISTENS_TO" ? edge.source : edge.target;

  return {
    id: `${source}-${edge.kind}-${target}-${index}`,
    source,
    target,
    label: edge.kind,
  };
};

const createFlowEdges = (edges: readonly ArchitectureEdge[]): FlowEdge[] =>
  edges.map(createVisualEdge);

const uniqueEdges = (edges: readonly ArchitectureEdge[]): ArchitectureEdge[] => {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const identity = `${edge.source}\u0000${edge.kind}\u0000${edge.target}`;
    if (seen.has(identity)) return false;

    seen.add(identity);
    return true;
  });
};

const mergeProjections = (...projections: readonly GraphProjection[]): GraphProjection => {
  const nodes = new Map<string, ArchitectureNode>();
  const edges = new Map<string, ArchitectureEdge>();

  for (const projection of projections) {
    for (const node of projection.nodes) nodes.set(node.id, node);
    for (const edge of uniqueEdges(projection.edges)) {
      edges.set(`${edge.source}\u0000${edge.kind}\u0000${edge.target}`, edge);
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
};

const formatRelation = (edge: ArchitectureGraph["edges"][number]): string =>
  `${edge.source} --${edge.kind}--> ${edge.target}`;

const relationLabel = (edge: ArchitectureGraph["edges"][number]): string =>
  `${edge.source} ${edge.kind} ${edge.target}`;

export const ArchitectureMap = ({ graph }: { graph: ArchitectureGraph }) => {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NodeKind | "All">("All");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [projection, setProjection] = useState<GraphProjection>();
  const [downstreamDepth, setDownstreamDepth] = useState<number>();
  const [upstreamDepth, setUpstreamDepth] = useState<number>();
  const displayedGraph = projection ?? graph;
  const displayedEdges = uniqueEdges(displayedGraph.edges);
  const visibleNodes = displayedGraph.nodes.filter(
    (node) =>
      node.id.toLowerCase().includes(query.toLowerCase()) &&
      (kindFilter === "All" || node.kind === kindFilter),
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const flowNodes = useMemo(
    () => layoutArchitectureNodes(visibleNodes, displayedEdges, selectedNodeId),
    [visibleNodes, displayedEdges, selectedNodeId],
  );
  const flowEdges = useMemo(
    () =>
      createFlowEdges(displayedEdges).filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [displayedEdges, visibleNodeIds],
  );
  const selectedNode = selectedNodeId ? graph.findNode(selectedNodeId) : undefined;
  const graphEdges = uniqueEdges(graph.edges);
  const incoming = selectedNode ? graphEdges.filter((edge) => edge.target === selectedNode.id) : [];
  const outgoing = selectedNode ? graphEdges.filter((edge) => edge.source === selectedNode.id) : [];

  const focusTerritory = (
    nodeId: string,
    nextDownstreamDepth: number | undefined,
    nextUpstreamDepth: number | undefined,
  ): void => {
    setProjection(
      mergeProjections(
        projectDownstream(graph, nodeId, createProjectionOptions(nextDownstreamDepth)),
        projectUpstream(graph, nodeId, createProjectionOptions(nextUpstreamDepth)),
      ),
    );
  };

  const selectNode = (nodeId: string): void => {
    setSelectedNodeId(nodeId);
    focusTerritory(nodeId, defaultFocusDepth, defaultFocusDepth);
  };

  return (
    <main data-testid="architecture-map" className="architecture-map-shell">
      <aside aria-label="Explorer" className="architecture-map-explorer">
        <label>
          Search nodes
          <input
            aria-label="Search nodes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Filter by node kind
          <select
            aria-label="Filter by node kind"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as NodeKind | "All")}
          >
            <option value="All">All</option>
            <option value="Event">Event</option>
            <option value="Handler">Handler</option>
            <option value="State">State</option>
            <option value="External">External</option>
          </select>
        </label>
        {visibleNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`architecture-node ${nodeKindClass(node.kind)}`}
            data-node-kind={node.kind}
            style={nodeKindStyles[node.kind]}
            onClick={() => selectNode(node.id)}
          >
            {node.id}
          </button>
        ))}
      </aside>

      <section aria-label="Map" className="architecture-map-canvas" style={{ height: 420 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => selectNode(node.id)}
          fitView
        >
          <Controls />
        </ReactFlow>
        <div aria-label="Architectural relations">
          {displayedEdges.map((edge, index) => (
            <span
              key={`${edge.source}-${edge.kind}-${edge.target}-${index}`}
              aria-label={relationLabel(edge)}
            >
              {edge.kind}
            </span>
          ))}
        </div>
      </section>

      <aside aria-label="Inspector" role="region" className="architecture-map-inspector">
        {selectedNode ? (
          <>
            <h2>{selectedNode.id}</h2>
            <p>Kind: {selectedNode.kind}</p>
            <p>
              Source:{" "}
              {selectedNode.sourceLocation
                ? `${selectedNode.sourceLocation.file}:${selectedNode.sourceLocation.line}`
                : "unavailable"}
            </p>
            <h3>Incoming relations</h3>
            {incoming.map((edge, index) => (
              <p key={`${edge.source}-${edge.kind}-${index}`}>{formatRelation(edge)}</p>
            ))}
            <h3>Outgoing relations</h3>
            {outgoing.map((edge, index) => (
              <p key={`${edge.kind}-${edge.target}-${index}`}>{formatRelation(edge)}</p>
            ))}
            <button
              type="button"
              aria-label={`Focus territory from ${selectedNode.id}`}
              onClick={() => focusTerritory(selectedNode.id, downstreamDepth, upstreamDepth)}
            >
              Focus territory
            </button>
            <label>
              Downstream depth
              <select
                aria-label="Downstream depth"
                value={downstreamDepth === undefined ? "all" : downstreamDepth}
                onChange={(event) => {
                  const value = event.target.value;
                  setDownstreamDepth(value === "all" ? undefined : Number(value));
                }}
              >
                <option value="all">All</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            <button
              type="button"
              aria-label={`Explore downstream from ${selectedNode.id}`}
              onClick={() =>
                setProjection(
                  projectDownstream(
                    graph,
                    selectedNode.id,
                    downstreamDepth === undefined ? undefined : { maxDepth: downstreamDepth },
                  ),
                )
              }
            >
              Explore downstream
            </button>
            <button
              type="button"
              aria-label={`Explore upstream from ${selectedNode.id}`}
              onClick={() =>
                setProjection(
                  projectUpstream(
                    graph,
                    selectedNode.id,
                    upstreamDepth === undefined ? undefined : { maxDepth: upstreamDepth },
                  ),
                )
              }
            >
              Explore upstream
            </button>
            <label>
              Upstream depth
              <select
                aria-label="Upstream depth"
                value={upstreamDepth === undefined ? "all" : upstreamDepth}
                onChange={(event) => {
                  const value = event.target.value;
                  setUpstreamDepth(value === "all" ? undefined : Number(value));
                }}
              >
                <option value="all">All</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>
            {projection ? (
              <button
                type="button"
                aria-label="Reset projection"
                onClick={() => {
                  setProjection(undefined);
                  setDownstreamDepth(undefined);
                  setUpstreamDepth(undefined);
                }}
              >
                Reset projection
              </button>
            ) : null}
          </>
        ) : (
          <p>Select a node</p>
        )}
      </aside>
    </main>
  );
};
