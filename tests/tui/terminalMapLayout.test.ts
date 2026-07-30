import { describe, expect, it } from "vitest";

import { layoutProjection, renderTerminalMap } from "../../src/tui/terminalMapLayout.js";

describe("terminal map layout", () => {
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
});
