import { describe, expect, it } from "vitest";

import {
  calculateMapHeight,
  layoutNeighborhood,
  layoutProjection,
  renderTerminalMap,
} from "../../src/tui/terminalMapLayout.js";
import { colorizeTerminalMap } from "../../src/tui/terminalMapColor.js";

describe("terminal map layout", () => {
  it("reserves space for the TUI header and status bar", () => {
    expect(calculateMapHeight(24)).toBe(12);
    expect(calculateMapHeight(10)).toBe(8);
  });

  it("renders a selected node with only its directly connected territory", () => {
    const projection = {
      nodes: [
        { id: "requested", kind: "Event" as const },
        { id: "handler", kind: "Handler" as const },
        { id: "state", kind: "State" as const },
        { id: "unrelated", kind: "External" as const },
      ],
      edges: [
        { source: "handler", target: "requested", kind: "LISTENS_TO" as const },
        { source: "handler", target: "state", kind: "DISPATCHES" as const },
      ],
    };

    const neighborhood = layoutNeighborhood(projection, "handler", { density: "normal" });

    expect(neighborhood.nodes.map(({ id }) => id)).toEqual(["requested", "handler", "state"]);
    expect(neighborhood.edges).toEqual(projection.edges);
    expect(neighborhood.nodes.find(({ id }) => id === "handler")?.x).toBeGreaterThan(0);
  });

  it("lays out cyclic architectural projections", () => {
    const projection = {
      nodes: [
        { id: "requested", kind: "Event" as const },
        { id: "handler", kind: "Handler" as const },
      ],
      edges: [
        { source: "handler", target: "requested", kind: "LISTENS_TO" as const },
        { source: "handler", target: "requested", kind: "DISPATCHES" as const },
      ],
    };

    const layout = layoutProjection(projection, { density: "normal" });

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toEqual(projection.edges);
  });

  it("makes the architectural kind of a visible edge readable", () => {
    const projection = {
      nodes: [
        { id: "requested", kind: "Event" as const },
        { id: "handler", kind: "Handler" as const },
      ],
      edges: [{ source: "handler", target: "requested", kind: "LISTENS_TO" as const }],
    };
    const layout = layoutProjection(projection, { density: "normal" });

    const map = renderTerminalMap(layout, { x: 0, y: 0, width: 80, height: 10 });

    expect(map.join("\n")).toContain("LISTENS_TO");
  });

  it("colors node kinds, relation labels and the selected marker", () => {
    const colored = colorizeTerminalMap([
      "> [H] handler ──DISPATCHES──▶ [E] event",
      "[S] state [X] gateway",
    ]).join("\n");

    expect(colored).toContain("\u001b[38;2;249;38;114m[H]");
    expect(colored).toContain("\u001b[38;2;117;113;94mDISPATCHES");
    expect(colored).toContain("\u001b[38;2;174;129;255m>");
  });

  it("routes branched relations with a visible vertical connection", () => {
    const projection = {
      nodes: [
        { id: "handler", kind: "Handler" as const },
        { id: "accepted", kind: "Event" as const },
        { id: "gateway", kind: "External" as const },
      ],
      edges: [
        { source: "handler", target: "accepted", kind: "DISPATCHES" as const },
        { source: "handler", target: "gateway", kind: "CALLS_EXTERNAL" as const },
      ],
    };
    const layout = layoutNeighborhood(projection, "handler", { density: "normal" });
    const map = renderTerminalMap(layout, { x: 0, y: 0, width: 100, height: 12 });

    expect(map.join("\n")).toContain("│");
    expect(map.join("\n")).toContain("DISPATCHES");
    expect(map.join("\n")).toContain("CALLS_EXTERNAL");
  });

  it("keeps node labels readable when an edge label crosses their row", () => {
    const layout = {
      nodes: [
        { id: "source", kind: "Handler" as const, x: 0, y: 0, width: 10, height: 1 },
        { id: "protectedNode", kind: "Event" as const, x: 15, y: 0, width: 22, height: 1 },
        { id: "target", kind: "External" as const, x: 45, y: 0, width: 10, height: 1 },
      ],
      edges: [{ source: "source", target: "target", kind: "CALLS_EXTERNAL" as const }],
    };

    expect(renderTerminalMap(layout, { x: 0, y: 0, width: 70, height: 4 }).join("\n")).toContain(
      "protectedNode",
    );
  });

  it("shortens relation labels only in compact density", () => {
    const projection = {
      nodes: [
        { id: "handler", kind: "Handler" as const },
        { id: "gateway", kind: "External" as const },
      ],
      edges: [{ source: "handler", target: "gateway", kind: "CALLS_EXTERNAL" as const }],
    };
    const layout = layoutNeighborhood(projection, "handler", { density: "compact" });

    const compact = renderTerminalMap(
      layout,
      { x: 0, y: 0, width: 80, height: 4 },
      "handler",
      "compact",
    ).join("\n");
    const normal = renderTerminalMap(
      layout,
      { x: 0, y: 0, width: 80, height: 4 },
      "handler",
      "normal",
    ).join("\n");

    expect(compact).toContain("EXTERNAL");
    expect(compact).not.toContain("CALLS_EXTERNAL");
    expect(normal).toContain("CALLS_EXTERNAL");
  });
});
