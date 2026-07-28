import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import {
  deserializeArchitectureGraph,
  serializeArchitectureGraph,
} from "../../src/application/architectureGraphJson.js";

describe("architecture graph JSON", () => {
  it("restores a serialized graph for visualizer consumption", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });

    const restored = deserializeArchitectureGraph(serializeArchitectureGraph(graph));

    expect(restored.findNode("requested")).toEqual({ id: "requested", kind: "Event" });
    expect(restored.upstream("requested")).toEqual([{ id: "listener", kind: "Handler" }]);
  });
});
