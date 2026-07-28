import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { projectDownstream } from "../../src/domain/graphProjection.js";
import { createTerminalVisualizerSession } from "../../src/tui/terminalVisualizer.js";

describe("Terminal visualizer acceptance", () => {
  it("renders a focused territory and inspects a selected node", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "LikeRequested", kind: "Event" });
    graph.addNode({
      id: "LikeHandler",
      kind: "Handler",
      sourceLocation: { file: "social/like.ts", line: 42 },
    });
    graph.addNode({ id: "LikeAccepted", kind: "Event" });
    graph.addNode({ id: "LikesState", kind: "State" });
    graph.addNode({ id: "SocialApi", kind: "External" });
    graph.addEdge({
      source: "LikeHandler",
      target: "LikeRequested",
      kind: "LISTENS_TO",
    });
    graph.addEdge({
      source: "LikeHandler",
      target: "LikeAccepted",
      kind: "DISPATCHES",
    });
    graph.addEdge({
      source: "LikeAccepted",
      target: "LikesState",
      kind: "UPDATES",
    });
    graph.addEdge({
      source: "LikeHandler",
      target: "SocialApi",
      kind: "CALLS_EXTERNAL",
    });

    const session = createTerminalVisualizerSession(projectDownstream(graph, "LikeRequested"));

    const initialView = session.render();
    expect(initialView).toContain("[E] LikeRequested");
    expect(initialView).toContain("[H] LikeHandler");
    expect(initialView).toContain("[E] LikeAccepted");
    expect(initialView).toContain("[S] LikesState");
    expect(initialView).toContain("[X] SocialApi");
    expect(initialView).toContain("LikeHandler --LISTENS_TO--> LikeRequested");

    session.search("LikeHandler");
    session.select("LikeHandler");

    const selectedView = session.render();
    expect(selectedView).toContain("> [H] LikeHandler");
    expect(selectedView).toContain("Kind: Handler");
    expect(selectedView).toContain("Source: social/like.ts:42");
    expect(selectedView).toContain("Incoming");
    expect(selectedView).toContain("LikeHandler --LISTENS_TO--> LikeRequested");
    expect(selectedView).toContain("Outgoing");
    expect(selectedView).toContain("LikeHandler --DISPATCHES--> LikeAccepted");
    expect(selectedView).toContain("LikeHandler --CALLS_EXTERNAL--> SocialApi");
  });
});
