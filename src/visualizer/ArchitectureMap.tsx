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

const createFlowNodes = (nodes: readonly ArchitectureNode[]): ArchitectureFlowNode[] =>
  nodes.map((node, index) => ({
    id: node.id,
    position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 120 },
    data: { node },
    type: "architecture",
  }));

const createFlowEdges = (edges: readonly ArchitectureEdge[]): FlowEdge[] =>
  edges.map((edge) => ({
    id: `${edge.source}-${edge.kind}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.kind,
  }));

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
  const displayedGraph = projection ?? graph;
  const visibleNodes = displayedGraph.nodes.filter(
    (node) =>
      node.id.toLowerCase().includes(query.toLowerCase()) &&
      (kindFilter === "All" || node.kind === kindFilter),
  );
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const flowNodes = useMemo(() => createFlowNodes(visibleNodes), [visibleNodes]);
  const flowEdges = useMemo(
    () =>
      createFlowEdges(displayedGraph.edges).filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [displayedGraph, visibleNodeIds],
  );
  const selectedNode = selectedNodeId ? graph.findNode(selectedNodeId) : undefined;
  const incoming = selectedNode
    ? graph.edges.filter((edge) => edge.target === selectedNode.id)
    : [];
  const outgoing = selectedNode
    ? graph.edges.filter((edge) => edge.source === selectedNode.id)
    : [];

  return (
    <main data-testid="architecture-map">
      <aside aria-label="Explorer">
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
            onClick={() => setSelectedNodeId(node.id)}
          >
            {node.id}
          </button>
        ))}
      </aside>

      <section aria-label="Map" style={{ height: 420 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          fitView
        >
          <Controls />
        </ReactFlow>
        <div aria-label="Architectural relations">
          {graph.edges.map((edge) => (
            <span
              key={`${edge.source}-${edge.kind}-${edge.target}`}
              aria-label={relationLabel(edge)}
            >
              {edge.kind}
            </span>
          ))}
        </div>
      </section>

      <aside aria-label="Inspector" role="region">
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
            {incoming.map((edge) => (
              <p key={`${edge.source}-${edge.kind}`}>{formatRelation(edge)}</p>
            ))}
            <h3>Outgoing relations</h3>
            {outgoing.map((edge) => (
              <p key={`${edge.kind}-${edge.target}`}>{formatRelation(edge)}</p>
            ))}
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
              onClick={() => setProjection(projectUpstream(graph, selectedNode.id))}
            >
              Explore upstream
            </button>
            {projection ? (
              <button
                type="button"
                aria-label="Reset projection"
                onClick={() => {
                  setProjection(undefined);
                  setDownstreamDepth(undefined);
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
