// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

describe("ArchitectureMap projection navigation", () => {
  afterEach(cleanup);

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

  it("focuses the upstream territory of a selected state", () => {
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

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Explorer" })).getByRole("button", {
        name: "socialState",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Explore upstream from socialState" }));

    expect(screen.getByRole("button", { name: "socialState" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "accepted" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "listener" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "requested" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "unrelated" })).toBeNull();
  });

  it("limits a downstream projection to the selected depth", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "accepted", kind: "Event" });
    graph.addNode({ id: "socialState", kind: "State" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "listener", target: "accepted", kind: "DISPATCHES" });
    graph.addEdge({ source: "accepted", target: "socialState", kind: "UPDATES" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.click(screen.getByRole("button", { name: "requested" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Downstream depth" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Explore downstream from requested" }));

    expect(screen.getByRole("button", { name: "requested" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "listener" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "accepted" })).toBeNull();
    expect(screen.queryByRole("button", { name: "socialState" })).toBeNull();
  });

  it("returns to the complete graph after exploring a projection", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "unrelated", kind: "Event" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.click(screen.getByRole("button", { name: "requested" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore downstream from requested" }));
    expect(screen.queryByRole("button", { name: "unrelated" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset projection" }));

    expect(screen.getByRole("button", { name: "unrelated" })).toBeTruthy();
  });

  it("hides relations outside the focused projection", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "unrelated", kind: "Event" });
    graph.addNode({ id: "otherListener", kind: "Handler" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "otherListener", target: "unrelated", kind: "LISTENS_TO" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.click(screen.getByRole("button", { name: "requested" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore downstream from requested" }));

    expect(screen.getByLabelText("listener LISTENS_TO requested")).toBeTruthy();
    expect(screen.queryByLabelText("otherListener LISTENS_TO unrelated")).toBeNull();
  });

  it("limits an upstream projection to the selected depth", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "accepted", kind: "Event" });
    graph.addNode({ id: "socialState", kind: "State" });
    graph.addEdge({ source: "listener", target: "requested", kind: "LISTENS_TO" });
    graph.addEdge({ source: "listener", target: "accepted", kind: "DISPATCHES" });
    graph.addEdge({ source: "accepted", target: "socialState", kind: "UPDATES" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.click(
      within(screen.getByRole("complementary", { name: "Explorer" })).getByRole("button", {
        name: "socialState",
      }),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Upstream depth" }), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Explore upstream from socialState" }));

    expect(screen.getByRole("button", { name: "socialState" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "accepted" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "listener" })).toBeNull();
    expect(screen.queryByRole("button", { name: "requested" })).toBeNull();
  });
});
