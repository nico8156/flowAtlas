// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { ArchitectureMap } from "../../src/visualizer/ArchitectureMap.js";

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

describe("ArchitectureMap projection navigation", () => {
  it("focuses the downstream territory of a selected node", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "accepted", kind: "Event" });
    graph.addNode({ id: "socialState", kind: "State" });
    graph.addNode({ id: "unrelated", kind: "Event" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "listener", target: "accepted", kind: "DISPATCHES" });
    graph.addEdge({ source: "accepted", target: "socialState", kind: "UPDATES" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.click(screen.getByRole("button", { name: "requested" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore downstream from requested" }));

    expect(screen.getByRole("button", { name: "requested" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "listener" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "accepted" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "socialState" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "unrelated" })).toBeNull();
  });
});
