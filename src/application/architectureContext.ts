import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
} from "../domain/architectureGraph.js";
import {
  projectDownstream,
  projectUpstream,
  type GraphProjection,
} from "../domain/graphProjection.js";
import { projectFocusedTerritory } from "./focusedGraphProjection.js";

export type ArchitectureContextDirection = "upstream" | "downstream" | "both";

export type ArchitectureContextLimits = {
  readonly maxNodes: number;
  readonly maxEdges: number;
  readonly maxBytes?: number;
};

export type ArchitectureContextLimit = "maxNodes" | "maxEdges" | "maxBytes";

export type ArchitectureContextFrontier = {
  readonly nodeId: string;
  readonly traversal: Exclude<ArchitectureContextDirection, "both">;
  readonly via: ArchitectureEdge;
};

export type ArchitectureContext = {
  readonly schemaVersion: 2;
  readonly focus: NonNullable<ReturnType<ArchitectureGraph["findNode"]>>;
  readonly request: {
    readonly direction: ArchitectureContextDirection;
    readonly maxDepth: number;
    readonly maxNodes?: number;
    readonly maxEdges?: number;
    readonly maxBytes?: number;
  };
  readonly complete: boolean;
  readonly frontierComplete: boolean;
  readonly omittedFrontierCount: number;
  readonly limitsReached: readonly ArchitectureContextLimit[];
  readonly returned: { readonly nodes: number; readonly edges: number };
  readonly frontier: readonly ArchitectureContextFrontier[];
  readonly projection: GraphProjection;
  readonly serializedBytes: number;
};

const downstreamTarget = (edge: ArchitectureEdge, nodeId: string): string | undefined =>
  edge.kind === "LISTENS_TO"
    ? edge.target === nodeId
      ? edge.source
      : undefined
    : edge.source === nodeId
      ? edge.target
      : undefined;

const upstreamTarget = (edge: ArchitectureEdge, nodeId: string): string | undefined =>
  edge.kind === "LISTENS_TO"
    ? edge.source === nodeId
      ? edge.target
      : undefined
    : edge.target === nodeId
      ? edge.source
      : undefined;

const traversalTargets = (
  edge: ArchitectureEdge,
  nodeId: string,
  direction: ArchitectureContextDirection,
): readonly string[] => {
  const targets = new Set<string>();
  if (direction !== "upstream") {
    const target = downstreamTarget(edge, nodeId);
    if (target) targets.add(target);
  }
  if (direction !== "downstream") {
    const target = upstreamTarget(edge, nodeId);
    if (target) targets.add(target);
  }
  return [...targets];
};

const compareIds = (left: string, right: string): number =>
  left.toLocaleLowerCase("en-US").localeCompare(right.toLocaleLowerCase("en-US"), "en-US") ||
  left.localeCompare(right, "en-US");

const inducedEdges = (
  projection: GraphProjection,
  nodeIds: ReadonlySet<string>,
): readonly ArchitectureEdge[] =>
  projection.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

const frontierTraversal = (
  edge: ArchitectureEdge,
  includedNodeId: string,
  omittedNodeId: string,
  direction: ArchitectureContextDirection,
): ArchitectureContextFrontier["traversal"] | undefined => {
  if (direction !== "upstream" && downstreamTarget(edge, includedNodeId) === omittedNodeId) {
    return "downstream";
  }
  if (direction !== "downstream" && upstreamTarget(edge, includedNodeId) === omittedNodeId) {
    return "upstream";
  }
  return undefined;
};

const boundProjection = (
  projection: GraphProjection,
  focusNode: ArchitectureNode,
  direction: ArchitectureContextDirection,
  limits: ArchitectureContextLimits,
): {
  projection: GraphProjection;
  complete: boolean;
  frontier: readonly ArchitectureContextFrontier[];
  limitsReached: readonly ArchitectureContextLimit[];
} => {
  const allowedNodeIds = new Set(projection.nodes.map(({ id }) => id));
  const includedNodeIds = new Set([focusNode.id]);
  const selectedNodeIds = [focusNode.id];
  let currentLayer = [focusNode.id];
  let stopped = false;
  const limitsReached = new Set<ArchitectureContextLimit>();

  while (currentLayer.length > 0 && !stopped) {
    const candidateNodeIds = new Set<string>();
    for (const nodeId of currentLayer) {
      for (const edge of projection.edges) {
        for (const target of traversalTargets(edge, nodeId, direction)) {
          if (allowedNodeIds.has(target) && !includedNodeIds.has(target)) {
            candidateNodeIds.add(target);
          }
        }
      }
    }

    const nextLayer: string[] = [];
    for (const candidateNodeId of [...candidateNodeIds].sort(compareIds)) {
      const prospectiveNodeIds = new Set(includedNodeIds).add(candidateNodeId);
      const prospectiveEdges = inducedEdges(projection, prospectiveNodeIds);
      if (prospectiveNodeIds.size > limits.maxNodes || prospectiveEdges.length > limits.maxEdges) {
        if (prospectiveNodeIds.size > limits.maxNodes) limitsReached.add("maxNodes");
        if (prospectiveEdges.length > limits.maxEdges) limitsReached.add("maxEdges");
        stopped = true;
        break;
      }

      includedNodeIds.add(candidateNodeId);
      selectedNodeIds.push(candidateNodeId);
      nextLayer.push(candidateNodeId);
    }
    currentLayer = nextLayer;
  }

  const nodesById = new Map(projection.nodes.map((node) => [node.id, node]));
  const boundedProjection = {
    nodes: selectedNodeIds
      .map((nodeId) => nodesById.get(nodeId))
      .filter((node): node is ArchitectureNode => node !== undefined),
    edges: inducedEdges(projection, includedNodeIds),
  };
  const complete = includedNodeIds.size === projection.nodes.length;
  const frontier = complete
    ? []
    : projection.edges
        .flatMap((edge): ArchitectureContextFrontier[] => {
          const sourceIncluded = includedNodeIds.has(edge.source);
          const targetIncluded = includedNodeIds.has(edge.target);
          if (sourceIncluded === targetIncluded) return [];

          const includedNodeId = sourceIncluded ? edge.source : edge.target;
          const omittedNodeId = sourceIncluded ? edge.target : edge.source;
          const traversal = frontierTraversal(edge, includedNodeId, omittedNodeId, direction);
          return traversal ? [{ nodeId: omittedNodeId, traversal, via: edge }] : [];
        })
        .sort(
          (left, right) =>
            compareIds(left.nodeId, right.nodeId) ||
            compareIds(left.traversal, right.traversal) ||
            compareIds(left.via.kind, right.via.kind) ||
            compareIds(left.via.source, right.via.source) ||
            compareIds(left.via.target, right.via.target),
        );

  return { projection: boundedProjection, complete, frontier, limitsReached: [...limitsReached] };
};

type ArchitectureContextWithoutSize = Omit<ArchitectureContext, "serializedBytes">;

const withSerializedSize = (context: ArchitectureContextWithoutSize): ArchitectureContext => {
  let serializedBytes = 0;
  while (true) {
    const candidate = { ...context, serializedBytes };
    const measuredBytes = Buffer.byteLength(JSON.stringify(candidate, null, 2), "utf8");
    if (measuredBytes === serializedBytes) return candidate;
    serializedBytes = measuredBytes;
  }
};

const contextEnvelope = (
  focus: ArchitectureNode,
  request: ArchitectureContext["request"],
  bounded: ReturnType<typeof boundProjection>,
  frontier: readonly ArchitectureContextFrontier[] = bounded.frontier,
  omittedFrontierCount = bounded.frontier.length - frontier.length,
  extraLimits: readonly ArchitectureContextLimit[] = [],
): ArchitectureContext =>
  withSerializedSize({
    schemaVersion: 2,
    focus,
    request,
    complete: bounded.complete,
    frontierComplete: omittedFrontierCount === 0,
    omittedFrontierCount,
    limitsReached: [...new Set([...bounded.limitsReached, ...extraLimits])],
    returned: {
      nodes: bounded.projection.nodes.length,
      edges: bounded.projection.edges.length,
    },
    frontier,
    projection: bounded.projection,
  });

const fitContextToByteBudget = (
  fullProjection: GraphProjection,
  focus: ArchitectureNode,
  direction: ArchitectureContextDirection,
  limits: ArchitectureContextLimits,
  request: ArchitectureContext["request"],
  initiallyBounded: ReturnType<typeof boundProjection>,
): ArchitectureContext => {
  const untrimmed = contextEnvelope(focus, request, initiallyBounded);
  if (untrimmed.serializedBytes <= (limits.maxBytes ?? Number.POSITIVE_INFINITY)) {
    return untrimmed;
  }

  let maxNodes = Math.min(limits.maxNodes, fullProjection.nodes.length);

  while (maxNodes >= 1) {
    const byteBounded = boundProjection(fullProjection, focus, direction, {
      maxNodes,
      maxEdges: limits.maxEdges,
    });
    const bounded = {
      ...byteBounded,
      limitsReached: initiallyBounded.limitsReached,
    };
    for (
      let frontierLength = bounded.frontier.length - 1;
      frontierLength >= 0;
      frontierLength -= 1
    ) {
      const candidate = contextEnvelope(
        focus,
        request,
        bounded,
        bounded.frontier.slice(0, frontierLength),
        bounded.frontier.length - frontierLength,
        ["maxBytes"],
      );
      if (candidate.serializedBytes <= (limits.maxBytes ?? Number.POSITIVE_INFINITY)) {
        return candidate;
      }
    }
    maxNodes -= 1;
  }

  throw new Error(`Context maxBytes is too small for the irreducible envelope: ${limits.maxBytes}`);
};

export const buildArchitectureContext = (
  graph: ArchitectureGraph,
  nodeId: string,
  direction: ArchitectureContextDirection,
  maxDepth: number,
  limits?: ArchitectureContextLimits,
): ArchitectureContext => {
  const focus = graph.findNode(nodeId);
  if (!focus) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  if (
    limits &&
    (!Number.isInteger(limits.maxNodes) ||
      limits.maxNodes <= 0 ||
      !Number.isInteger(limits.maxEdges) ||
      limits.maxEdges < 0 ||
      (limits.maxBytes !== undefined &&
        (!Number.isInteger(limits.maxBytes) || limits.maxBytes <= 0)))
  ) {
    throw new Error("Context limits require maxNodes > 0, maxEdges >= 0 and maxBytes > 0");
  }

  const fullProjection =
    direction === "downstream"
      ? projectDownstream(graph, nodeId, { maxDepth })
      : direction === "upstream"
        ? projectUpstream(graph, nodeId, { maxDepth })
        : projectFocusedTerritory(graph, nodeId, maxDepth);
  const structuralLimits = limits ?? {
    maxNodes: fullProjection.nodes.length,
    maxEdges: fullProjection.edges.length,
  };
  const bounded = limits
    ? boundProjection(fullProjection, focus, direction, limits)
    : boundProjection(fullProjection, focus, direction, structuralLimits);
  const request = { direction, maxDepth, ...limits };

  return limits?.maxBytes === undefined
    ? contextEnvelope(focus, request, bounded)
    : fitContextToByteBudget(fullProjection, focus, direction, limits, request, bounded);
};

export const serializeArchitectureContext = (context: ArchitectureContext): string =>
  JSON.stringify(context, null, 2);
