import { describe, expect, it } from "vitest";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";

describe("TypeScript scanner", () => {
  it("detects an Event declared with createAction", async () => {
    const file = "tests/fixtures/createAction.ts";
    const source = 'const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");';

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "uiLikeToggleRequested",
      kind: "Event",
    });
  });
});
