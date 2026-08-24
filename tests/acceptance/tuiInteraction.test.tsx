import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { projectDownstream } from "../../src/domain/graphProjection.js";
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

const nextFrame = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("Terminal visualizer interaction acceptance", () => {
  it("navigates panes, searches and updates the inspector from keyboard input", async () => {
    const instance = render(
      <TerminalTui initialSelectedNodeId="LikeRequested" projection={createFixtureProjection()} />,
    );

    expect(instance.lastFrame()).toContain("Explorer · active");
    expect(instance.lastFrame()).toContain("Map");
    expect(instance.lastFrame()).toContain("Inspector");
    expect(instance.lastFrame()).toContain("LikeRequested");

    instance.stdin.write("\t");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Map · active");

    instance.stdin.write("\t");
    instance.stdin.write("\t");
    await nextFrame();
    instance.stdin.write("/");
    await nextFrame();
    instance.stdin.write("LikeHandler");
    await nextFrame();
    instance.stdin.write("\r");
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
    await nextFrame();
    instance.stdin.write("l");
    instance.stdin.write("+");
    await nextFrame();
    const mapFrame = instance.lastFrame() ?? "";
    expect(mapFrame).toContain("Map · active");
    expect(mapFrame).toContain("Density: detailed");
    expect(mapFrame).toContain("LikeHandler");
    expect(mapFrame).toContain("Kind: Handler");

    instance.stdin.write("n");
    await nextFrame();
    const neighborhoodFrame = instance.lastFrame() ?? "";
    expect(neighborhoodFrame).toContain("Map · active");
    expect(neighborhoodFrame).toContain("Representation: neighborhood");
    expect(neighborhoodFrame).toContain("Kind: Handler");

    instance.stdin.write("t");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Representation: territory");

    instance.stdin.write("q");
    await nextFrame();
    instance.cleanup();
  });
});
