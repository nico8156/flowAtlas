// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { VisualizerApp } from "../../src/visualizer/VisualizerApp.js";

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

describe("VisualizerApp", () => {
  it("provides the FlowAtlas visualizer shell and graph loader", () => {
    render(<VisualizerApp />);

    expect(screen.getByRole("heading", { name: "FlowAtlas" })).toBeTruthy();
    expect(screen.getByLabelText("Load architecture graph")).toBeTruthy();
  });
});
