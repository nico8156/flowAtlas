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

  it("detects a Handler listening to an Event", () => {
    const file = "tests/fixtures/listener.ts";
    const source = `
      const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
      const submitLikeListener = startListening({
        actionCreator: uiLikeToggleRequested,
        effect: async () => {},
      });
    `;

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "submitLikeListener",
      kind: "Handler",
    });
    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });
});
