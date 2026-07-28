// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { ArchitectureMapLoader } from "../../src/visualizer/ArchitectureMapLoader.js";

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

describe("ArchitectureMapLoader", () => {
  it("renders a graph loaded from a JSON file", async () => {
    render(<ArchitectureMapLoader />);

    const file = new File(
      [JSON.stringify({ nodes: [{ id: "requested", kind: "Event" }], edges: [] })],
      "graph.json",
      { type: "application/json" },
    );
    fireEvent.change(screen.getByLabelText("Load architecture graph"), {
      target: { files: [file] },
    });

    expect(await screen.findByRole("button", { name: "requested" })).toBeTruthy();
  });
});
