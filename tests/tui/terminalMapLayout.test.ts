import { describe, expect, it } from "vitest";

import {
  layoutNeighborhood,
  layoutProjection,
  renderTerminalMap,
} from "../../src/tui/terminalMapLayout.js";
import { colorizeTerminalMap } from "../../src/tui/terminalMapColor.js";

describe("terminal map layout", () => {
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
});
