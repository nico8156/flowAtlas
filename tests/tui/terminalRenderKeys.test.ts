import { describe, expect, it } from "vitest";

import { relationRenderKey } from "../../src/tui/terminalRenderKeys.js";

describe("terminal render keys", () => {
  it("keeps repeated relation lines distinct", () => {
    const first = relationRenderKey("out", "handler --DISPATCHES--> event", 0);
    const second = relationRenderKey("out", "handler --DISPATCHES--> event", 1);

    expect(first).not.toBe(second);
  });
});
