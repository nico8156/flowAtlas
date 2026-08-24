import { render } from "ink-testing-library";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { projectDownstream } from "../../src/domain/graphProjection.js";
import { TerminalTuiLoader, type TerminalTuiLoadResult } from "../../src/tui/TerminalTui.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const createFixtureResult = (): TerminalTuiLoadResult => {
  const graph = createArchitectureGraph();
  graph.addNode({ id: "LikeRequested", kind: "Event" });
  graph.addNode({ id: "LikeHandler", kind: "Handler" });
  graph.addEdge({ source: "LikeHandler", target: "LikeRequested", kind: "LISTENS_TO" });

  return {
    initialSelectedNodeId: "LikeRequested",
    projection: projectDownstream(graph, "LikeRequested"),
  };
};

const nextMicrotask = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const nextImmediate = async (): Promise<void> => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

describe("Terminal visualizer loading acceptance", () => {
  it("renders the shell while loading and the graph after resolution", async () => {
    let resolveLoad: ((result: TerminalTuiLoadResult) => void) | undefined;
    const load = new Promise<TerminalTuiLoadResult>((resolve) => {
      resolveLoad = resolve;
    });
    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<TerminalTuiLoader projectLabel="Fragments" load={() => load} />);
      await nextMicrotask();
      await nextImmediate();
    });

    const loadingFrame = instance.lastFrame() ?? "";
    expect(loadingFrame).toContain("ANALYZING PROJECT");
    expect(loadingFrame).toContain("Explorer");
    expect(loadingFrame).toContain("Map");
    expect(loadingFrame).toContain("Inspector");
    expect(loadingFrame).not.toContain("LikeRequested");

    await act(async () => {
      resolveLoad?.(createFixtureResult());
      await load;
      await nextMicrotask();
    });

    const readyFrame = instance.lastFrame() ?? "";
    expect(readyFrame).toContain("READY");
    expect(readyFrame).toContain("LikeRequested");

    await act(async () => {
      instance.stdin.write("\t");
      await nextMicrotask();
    });
    const inspectorFrame = instance.lastFrame() ?? "";
    expect(inspectorFrame).toContain("Kind: Event");

    await act(async () => {
      instance.cleanup();
      await nextMicrotask();
    });
  });

  it("renders a readable error when loading fails", async () => {
    let rejectLoad: ((error: Error) => void) | undefined;
    const load = new Promise<TerminalTuiLoadResult>((_, reject) => {
      rejectLoad = reject;
    });
    let instance!: ReturnType<typeof render>;
    await act(async () => {
      instance = render(<TerminalTuiLoader projectLabel="Fragments" load={() => load} />);
      await nextMicrotask();
      await nextImmediate();
    });

    await act(async () => {
      rejectLoad?.(new Error("project could not be analyzed"));
      await load.catch(() => undefined);
      await nextMicrotask();
    });

    const errorFrame = instance.lastFrame() ?? "";
    expect(errorFrame).toContain("ERROR");
    expect(errorFrame).toContain("project could not be analyzed");

    await act(async () => {
      instance.cleanup();
      await nextMicrotask();
    });
  });
});
