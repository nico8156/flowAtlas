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
    expect(frame).toContain("LikeHandler --LISTENS_TO--> LikeRequested");
    expect(frame).toContain("LikeHandler --DISPATCHES--> LikeAccepted");
    expect(frame).toContain("LikeHandler --CALLS_EXTERNAL--> SocialApi");

    instance.stdin.write("q");
    await nextFrame();
    instance.cleanup();
  });
});
