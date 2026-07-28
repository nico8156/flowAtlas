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

describe("ArchitectureMap node kind filter", () => {
  it("filters the visible territory by architectural node kind", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "socialState", kind: "State" });
    graph.addNode({ id: "LikeGateway", kind: "External" });

    render(<ArchitectureMap graph={graph} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by node kind" }), {
      target: { value: "Event" },
    });

    expect(screen.getByRole("button", { name: "requested" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "listener" })).toBeNull();
    expect(screen.queryByRole("button", { name: "socialState" })).toBeNull();
    expect(screen.queryByRole("button", { name: "LikeGateway" })).toBeNull();
  });
});
