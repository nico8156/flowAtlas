// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { serializeArchitectureGraph } from "../../src/application/architectureGraphJson.js";
import { ArchitectureMapFromJson } from "../../src/visualizer/ArchitectureMapFromJson.js";

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

describe("ArchitectureMapFromJson", () => {
  it("renders a serialized architecture graph", () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });

    render(<ArchitectureMapFromJson json={serializeArchitectureGraph(graph)} />);

    expect(screen.getByRole("button", { name: "requested" })).toBeTruthy();
  });
});
