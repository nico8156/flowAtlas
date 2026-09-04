import { describe, expect, it } from "vitest";

import { runContextOperationsBenchmark } from "../../src/benchmark/contextOperationsBenchmark.js";
import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";

describe("context operations benchmark", () => {
  it("measures node lookup, bounded projection and serialization independently", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "handler", kind: "Handler" });
    graph.addNode({ id: "event", kind: "Event" });
    graph.addEdge({ source: "handler", target: "event", kind: "DISPATCHES" });
    const timestamps = [0, 1, 1, 4, 4, 6, 6, 7, 7, 10, 10, 12];

    const report = runContextOperationsBenchmark({
      graph,
      nodeId: "handler",
      iterations: 2,
      now: () => timestamps.shift() ?? 12,
    });

    expect(report).toMatchObject({
      schemaVersion: 1,
      benchmark: "context-operations",
      iterations: 2,
      timings: {
        findNode: { medianMs: 1, p95Ms: 1, maxMs: 1 },
        contextProjection: { medianMs: 3, p95Ms: 3, maxMs: 3 },
        serialization: { medianMs: 2, p95Ms: 2, maxMs: 2 },
      },
      serializedBytes: expect.any(Number),
    });
  });
});
