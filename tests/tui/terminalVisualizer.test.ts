import { describe, expect, it } from "vitest";

import { filterTerminalProjection } from "../../src/tui/terminalVisualizer.js";

describe("terminal projection", () => {
  it("keeps one visual edge for repeated architectural relations", () => {
    const projection = filterTerminalProjection(
      {
        nodes: [
          { id: "handler", kind: "Handler" },
          { id: "event", kind: "Event" },
        ],
        edges: [
          { source: "handler", target: "event", kind: "DISPATCHES" },
          { source: "handler", target: "event", kind: "DISPATCHES" },
        ],
      },
      ["Event", "Handler", "State", "External"],
    );

    expect(projection.edges).toHaveLength(1);
  });
});
