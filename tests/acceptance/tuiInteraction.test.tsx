import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { projectDownstream, projectUpstream } from "../../src/domain/graphProjection.js";
import { TerminalTui } from "../../src/tui/TerminalTui.js";

const createFixtureProjection = () => {
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
  graph.addEdge({ source: "LikeHandler", target: "LikeRequested", kind: "LISTENS_TO" });
  graph.addEdge({ source: "LikeHandler", target: "LikeAccepted", kind: "DISPATCHES" });
  graph.addEdge({ source: "LikeAccepted", target: "LikesState", kind: "UPDATES" });
  graph.addEdge({ source: "LikeHandler", target: "SocialApi", kind: "CALLS_EXTERNAL" });

  return projectDownstream(graph, "LikeRequested");
};

const createLongProjection = () => ({
  nodes: Array.from({ length: 40 }, (_, index) => ({
    id: `Node${String(index).padStart(2, "0")}`,
    kind: "Event" as const,
  })),
  edges: [],
});

const nextFrame = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("Terminal visualizer interaction acceptance", () => {
  it("navigates panes, searches and updates the inspector from keyboard input", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="LikeRequested" projection={createFixtureProjection()} />,
    );

    expect(instance.lastFrame()).toContain("Map · active");
    expect(instance.lastFrame()).not.toContain("Explorer · active");
    expect(instance.lastFrame()).toContain("LikeRequested");

    instance.stdin.write("e");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Explorer · active");
    instance.stdin.write("h");
    await nextFrame();
    const filteredExplorerFrame = instance.lastFrame() ?? "";
    expect(filteredExplorerFrame).toContain("Kinds: H · 0 all");
    expect(filteredExplorerFrame).toContain("[H] LikeHandler");
    expect(filteredExplorerFrame).not.toContain("[E] LikeRequested");
    instance.stdin.write("h");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Kinds: E H S X · 0 all");
    instance.stdin.write("/");
    await nextFrame();
    instance.stdin.write("LikeHandler");
    await nextFrame();
    instance.stdin.write("\r");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Map · active");

    instance.stdin.write("i");
    await nextFrame();

    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("LikeHandler");
    expect(frame).toContain("Kind: Handler");
    expect(frame).toContain("social/like.ts:42");
    expect(frame).toContain("LikeRequested");
    expect(frame).toContain("LikeAccepted");
    expect(frame).toContain("SocialApi");
    expect(frame).toContain("LISTENS_TO");
    expect(frame).toContain("DISPATCHES");
    expect(frame).toContain("CALLS_EXTERNAL");

    instance.stdin.write("\t");
    instance.stdin.write("\t");
    await nextFrame();
    instance.stdin.write("l");
    instance.stdin.write("+");
    await nextFrame();
    const mapFrame = instance.lastFrame() ?? "";
    expect(mapFrame).toContain("Map · active");
    expect(mapFrame).toContain("Density: detailed");
    expect(mapFrame).toContain("LikeHandler");

    instance.stdin.write("n");
    await nextFrame();
    const neighborhoodFrame = instance.lastFrame() ?? "";
    expect(neighborhoodFrame).toContain("Map · active");
    expect(neighborhoodFrame).toContain("Representation: neighborhood");
    expect(neighborhoodFrame).not.toContain("hjkl pan");

    instance.stdin.write("t");
    await nextFrame();
    const territoryFrame = instance.lastFrame() ?? "";
    expect(territoryFrame).toContain("Representation: territory");
    expect(territoryFrame).not.toContain("hjkl pan");
    expect(territoryFrame).toContain("Representation: territory · stacked");

    instance.stdin.write("q");
    await nextFrame();
    instance.cleanup();
  });

  it("keeps a long explorer list within the terminal and scrolls to the cursor", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="Node00" projection={createLongProjection()} />,
    );

    instance.stdin.write("e");
    await nextFrame();
    const initialFrame = instance.lastFrame() ?? "";
    expect(initialFrame).toContain("Node00");
    expect(initialFrame).not.toContain("Node39");

    for (let index = 0; index < 39; index += 1) {
      instance.stdin.write("j");
      await nextFrame();
    }
    const scrolledFrame = instance.lastFrame() ?? "";
    expect(scrolledFrame).toContain("> [E] Node39");
    expect(scrolledFrame).not.toContain("Node00");

    instance.cleanup();
  });

  it("selects the Explorer cursor and returns to the Map", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="Node00" projection={createLongProjection()} />,
    );

    instance.stdin.write("e");
    await nextFrame();
    instance.stdin.write("j");
    await nextFrame();
    instance.stdin.write("\r");
    await nextFrame();

    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("Map · active");
    expect(frame).toContain("Representation: neighborhood");
    expect(frame).toContain("Node01");
    instance.cleanup();
  });

  it("restores the full map after selecting from a filtered Explorer", async () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "LikeRequested", kind: "Event" });
    graph.addNode({ id: "LikeHandler", kind: "Handler" });
    graph.addNode({ id: "LikeAccepted", kind: "Event" });
    graph.addNode({ id: "LikesState", kind: "State" });
    graph.addNode({ id: "SocialApi", kind: "External" });
    graph.addEdge({ source: "LikeHandler", target: "LikeRequested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "LikeHandler", target: "LikeAccepted", kind: "DISPATCHES" });
    graph.addEdge({ source: "LikeAccepted", target: "LikesState", kind: "UPDATES" });
    graph.addEdge({ source: "LikeHandler", target: "SocialApi", kind: "CALLS_EXTERNAL" });

    const instance = render(
      <TerminalTui
        initialSelectedNodeId="LikeRequested"
        projection={{ nodes: graph.nodes, edges: graph.edges }}
        projectFocus={(nodeId) => ({
          mode: "focus",
          projection: { nodes: graph.nodes, edges: graph.edges },
          rootNodeId: nodeId,
        })}
      />,
    );

    instance.stdin.write("e");
    await nextFrame();
    instance.stdin.write("h");
    await nextFrame();
    instance.stdin.write("j");
    await nextFrame();
    instance.stdin.write("\r");
    await nextFrame();
    instance.stdin.write("i");
    await nextFrame();

    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("LikeHandler");
    expect(frame).toContain("LikeRequested");
    expect(frame).toContain("LikeAccepted");
    expect(frame).toContain("SocialApi");
    expect(frame).toContain("DISPATCHES");
    expect(frame).toContain("CALLS_EXTERNAL");

    instance.cleanup();
  });

  it("keeps a visible selection when the requested node is absent", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="missingNode" projection={createLongProjection()} />,
    );

    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("\u001b[38;2;174;129;255m>");
    expect(frame).toContain("Node00");
    instance.cleanup();
  });

  it("resets Explorer filters and search when leaving the screen", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="LikeRequested" projection={createFixtureProjection()} />,
    );

    instance.stdin.write("e");
    await nextFrame();
    instance.stdin.write("h");
    await nextFrame();
    instance.stdin.write("/");
    await nextFrame();
    instance.stdin.write("LikeHandler");
    await nextFrame();
    instance.stdin.write("\r");
    await nextFrame();
    instance.stdin.write("e");
    await nextFrame();

    const resetFrame = instance.lastFrame() ?? "";
    expect(resetFrame).toContain("Kinds: E H S X · 0 all");
    expect(resetFrame).toContain("/ search");
    expect(resetFrame).toContain("[E] LikeRequested");

    instance.cleanup();
  });

  it("shows the handlers that dispatch a selected event", async () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "Requested", kind: "Event" });
    graph.addNode({ id: "ListeningHandler", kind: "Handler" });
    graph.addNode({ id: "DispatchingHandler", kind: "Handler" });
    graph.addNode({ id: "State", kind: "State" });
    graph.addEdge({ source: "ListeningHandler", target: "Requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "DispatchingHandler", target: "Requested", kind: "DISPATCHES" });
    graph.addEdge({ source: "Requested", target: "State", kind: "UPDATES" });

    const instance = render(
      <TerminalTui
        initialSelectedNodeId="Requested"
        projection={{ nodes: graph.nodes, edges: graph.edges }}
        projectIncomingHandlers={(nodeId) => ({
          mode: "handlers",
          projection: projectUpstream(graph, nodeId, { maxDepth: 1 }),
          rootNodeId: nodeId,
        })}
      />,
    );

    instance.stdin.write("r");
    await nextFrame();
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("HANDLERS · Requested");
    expect(frame).toContain("DispatchingHandler");
    expect(frame).not.toContain("ListeningHandler");
    expect(frame).not.toContain("State");

    instance.cleanup();
  });
});
