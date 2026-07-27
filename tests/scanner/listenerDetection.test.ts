import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";
describe("Handler and listener detection", () => {
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

  it("detects an Event dispatched by a Handler", () => {
    const file = "tests/fixtures/dispatch.ts";
    const source = `
      const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
      const likeAccepted = createAction("LIKE/ACCEPTED");
      const submitLikeListener = startListening({
        actionCreator: uiLikeToggleRequested,
        effect: async (_, api) => {
          api.dispatch(likeAccepted());
        },
      });
    `;

    const graph = scanTypeScriptSource({ file, source });
    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "likeAccepted",
      kind: "DISPATCHES",
    });
  });

  it("detects a Handler registered through a local listener alias", async () => {
    const file = "tests/fixtures/localListenerAlias.ts";
    const source = await readFile(
      new URL("../fixtures/localListenerAlias.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "likeToggleUseCaseFactory",
        kind: "Handler",
      }),
    );
    expect(graph.edges).toContainEqual({
      source: "likeToggleUseCaseFactory",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });

  it("detects an Event dispatched by a locally aliased listener", async () => {
    const file = "tests/fixtures/localListenerAliasDispatch.ts";
    const source = await readFile(
      new URL("../fixtures/localListenerAliasDispatch.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "likeToggleUseCaseFactory",
      target: "likeOptimisticApplied",
      kind: "DISPATCHES",
    });
  });

  it("ignores an unresolved dispatched Event without failing the scan", async () => {
    const file = "tests/fixtures/unresolvedDispatch.ts";
    const source = await readFile(
      new URL("../fixtures/unresolvedDispatch.ts", import.meta.url),
      "utf8",
    );
    let graph: ReturnType<typeof scanTypeScriptSource> | undefined;

    expect(() => {
      graph = scanTypeScriptSource({ file, source });
    }).not.toThrow();

    expect(graph?.edges).toContainEqual({
      source: "submitListener",
      target: "knownEvent",
      kind: "DISPATCHES",
    });
    expect(graph?.edges).not.toContainEqual({
      source: "submitListener",
      target: "missingEvent",
      kind: "DISPATCHES",
    });
  });
});
