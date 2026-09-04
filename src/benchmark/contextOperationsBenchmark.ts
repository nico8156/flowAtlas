import { performance } from "node:perf_hooks";

import {
  buildArchitectureContext,
  serializeArchitectureContext,
} from "../application/architectureContext.js";
import type { ArchitectureGraph } from "../domain/architectureGraph.js";

type ContextOperationsBenchmarkOptions = {
  graph: ArchitectureGraph;
  nodeId: string;
  iterations: number;
  now?: () => number;
};

const round = (value: number): number => Math.round(value * 100) / 100;

const summarize = (samples: readonly number[]) => {
  const ordered = [...samples].sort((left, right) => left - right);
  const percentileIndex = Math.min(ordered.length - 1, Math.ceil(ordered.length * 0.95) - 1);
  const middle = Math.floor(ordered.length / 2);
  const median =
    ordered.length % 2 === 0
      ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
      : (ordered[middle] ?? 0);
  return {
    medianMs: round(median),
    p95Ms: ordered[percentileIndex] ?? 0,
    maxMs: ordered.at(-1) ?? 0,
  };
};

export const runContextOperationsBenchmark = ({
  graph,
  nodeId,
  iterations,
  now = () => performance.now(),
}: ContextOperationsBenchmarkOptions) => {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error("Context benchmark iterations must be a positive integer.");
  }
  const findNodeMs: number[] = [];
  const contextProjectionMs: number[] = [];
  const serializationMs: number[] = [];
  let serialized = "";

  for (let index = 0; index < iterations; index += 1) {
    let startedAt = now();
    const node = graph.findNode(nodeId);
    findNodeMs.push(round(now() - startedAt));
    if (!node) throw new Error(`Benchmark node not found: ${nodeId}`);

    startedAt = now();
    const context = buildArchitectureContext(graph, nodeId, "both", 3, {
      maxNodes: 40,
      maxEdges: 80,
    });
    contextProjectionMs.push(round(now() - startedAt));

    startedAt = now();
    serialized = serializeArchitectureContext(context);
    serializationMs.push(round(now() - startedAt));
  }

  return {
    schemaVersion: 1 as const,
    benchmark: "context-operations" as const,
    nodeId,
    iterations,
    graph: { nodes: graph.nodes.length, edges: graph.edges.length },
    timings: {
      findNode: summarize(findNodeMs),
      contextProjection: summarize(contextProjectionMs),
      serialization: summarize(serializationMs),
    },
    serializedBytes: Buffer.byteLength(serialized, "utf8"),
  };
};
