import { describe, expect, it } from "vitest";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";
import { readFixture } from "./fixtureSource.js";

describe("Event detection", () => {
  it("detects an Event declared with createAction", async () => {
    const file = "tests/fixtures/createAction.ts";
    const source = 'const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");';

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "uiLikeToggleRequested",
        kind: "Event",
      }),
    );
  });

  it("preserves the source location of a detected Event", () => {
    const file = "src/social/actions.ts";
    const source = `
      const likeAccepted = createAction("LIKE/ACCEPTED");
    `;

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "likeAccepted",
      kind: "Event",
      sourceLocation: {
        file,
        line: 2,
      },
    });
  });

  it("detects projection.updated as an external-protocol Event", async () => {
    const file = "tests/fixtures/projectionUpdatedEvent.ts";
    const source = await readFixture("projectionUpdatedEvent.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "projection.updated",
        kind: "Event",
        source: "external-protocol",
      }),
    );
  });
});
