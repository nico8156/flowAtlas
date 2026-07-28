// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

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

describe("ArchitectureMap", () => {
  afterEach(cleanup);

  it("renders, searches and inspects a selected architectural node", () => {
    const graph = createArchitectureGraph();
    graph.addNode({
      id: "likeRequested",
      kind: "Event",
      sourceLocation: { file: "social/actions.ts", line: 12 },
    });
    graph.addNode({ id: "submitLikeListener", kind: "Handler" });
    graph.addEdge({
      source: "submitLikeListener",
      target: "likeRequested",
      kind: "LISTENS_TO",
    });

    render(<ArchitectureMap graph={graph} />);

    expect(screen.getByTestId("architecture-map")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Search nodes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "likeRequested" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "submitLikeListener" })).toBeTruthy();
    expect(screen.getByLabelText("submitLikeListener LISTENS_TO likeRequested")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Search nodes" }), {
      target: { value: "likeRequested" },
    });
    fireEvent.click(screen.getByRole("button", { name: "likeRequested" }));

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(inspector.textContent).toContain("likeRequested");
    expect(inspector.textContent).toContain("Event");
    expect(inspector.textContent).toContain("social/actions.ts:12");
    expect(inspector.textContent).toContain("submitLikeListener --LISTENS_TO--> likeRequested");
  });

  it("exposes controls for navigating the map viewport", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });

    render(<ArchitectureMap graph={graph} />);

    expect(screen.getByRole("button", { name: "Zoom In" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom Out" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fit View" })).toBeTruthy();
  });

  it("renders one visual relation for duplicate architectural edges", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });

    render(<ArchitectureMap graph={graph} />);

    expect(screen.getAllByLabelText("listener LISTENS_TO requested")).toHaveLength(1);
  });
});
