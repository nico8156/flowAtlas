import { describe, expect, it } from "vitest";

import {
  buildArchitectureContext,
  serializeArchitectureContext,
} from "../../src/application/architectureContext.js";
import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";

describe("architecture context", () => {
  it("bounds the complete serialized envelope and reports an omitted frontier", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "handler", kind: "Handler" });
    for (let index = 1; index <= 8; index += 1) {
      const eventId = `event-with-a-descriptive-identifier-${index}`;
      graph.addNode({ id: eventId, kind: "Event" });
      graph.addEdge({ source: "handler", target: eventId, kind: "DISPATCHES" });
    }

    const context = buildArchitectureContext(graph, "handler", "downstream", 1, {
      maxNodes: 9,
      maxEdges: 8,
      maxBytes: 900,
    });
    const serialized = serializeArchitectureContext(context);

    expect(context).toMatchObject({
      schemaVersion: 2,
      focus: { id: "handler" },
      frontierComplete: false,
      limitsReached: expect.arrayContaining(["maxBytes"]),
    });
    expect(context.omittedFrontierCount).toBeGreaterThan(0);
    expect(context.serializedBytes).toBe(Buffer.byteLength(serialized, "utf8"));
    expect(context.serializedBytes).toBeLessThanOrEqual(900);
  });
});
