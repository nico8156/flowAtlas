// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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

describe("ArchitectureMap node kinds", () => {
  it("visually distinguishes Event, Handler, State and External nodes", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    graph.addNode({ id: "listener", kind: "Handler" });
    graph.addNode({ id: "socialState", kind: "State" });
    graph.addNode({ id: "LikeGateway", kind: "External" });

    render(<ArchitectureMap graph={graph} />);

    expect(screen.getByRole("button", { name: "requested" }).getAttribute("data-node-kind")).toBe(
      "Event",
    );
    expect(screen.getByRole("button", { name: "listener" }).getAttribute("data-node-kind")).toBe(
      "Handler",
    );
    expect(screen.getByRole("button", { name: "socialState" }).getAttribute("data-node-kind")).toBe(
      "State",
    );
    expect(screen.getByRole("button", { name: "LikeGateway" }).getAttribute("data-node-kind")).toBe(
      "External",
    );
  });
});
