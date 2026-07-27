import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  scanTypeScriptProject,
  scanTypeScriptSource,
} from "../../src/scanner/typeScriptScanner.js";

describe("TypeScript scanner", () => {
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

  it("detects a State updated by an Event", () => {
    const file = "tests/fixtures/slice.ts";
    const source = `
      const likeAccepted = createAction("LIKE/ACCEPTED");
      const socialSlice = createSlice({
        name: "social",
        initialState: {},
        reducers: {},
        extraReducers: (builder) => {
          builder.addCase(likeAccepted, (state) => state);
        },
      });
    `;

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "socialSlice",
      kind: "State",
    });
    expect(graph.edges).toContainEqual({
      source: "likeAccepted",
      target: "socialSlice",
      kind: "UPDATES",
    });
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

  it("aggregates a simple cross-file topology", () => {
    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/social/actions.ts",
          source: `
            export const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
          `,
        },
        {
          file: "src/social/listener.ts",
          source: `
            import { uiLikeToggleRequested } from "./actions";
            const submitLikeListener = startListening({
              actionCreator: uiLikeToggleRequested,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "uiLikeToggleRequested",
        kind: "Event",
      }),
    );
    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });

  it("preserves Event identity through a renamed import", () => {
    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/social/actions.ts",
          source: `
            export const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
          `,
        },
        {
          file: "src/social/listener.ts",
          source: `
            import { uiLikeToggleRequested as toggleRequested } from "./actions";
            const submitLikeListener = startListening({
              actionCreator: toggleRequested,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });

  it("resolves an aliased import to the correct homonymous module symbol", () => {
    const graph = scanTypeScriptProject({
      tsconfig: {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
          },
        },
      },
      files: [
        {
          file: "src/tickets/actions.ts",
          source: `
            export const refreshed = createAction("TICKETS/REFRESHED");
          `,
        },
        {
          file: "src/social/actions.ts",
          source: `
            export const refreshed = createAction("SOCIAL/REFRESHED");
          `,
        },
        {
          file: "src/listener.ts",
          source: `
            import { refreshed } from "@/social/actions";
            const refreshListener = startListening({
              actionCreator: refreshed,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    const socialEvent = graph.nodes.find(
      (node) => node.kind === "Event" && node.sourceLocation?.file === "src/social/actions.ts",
    );
    const ticketsEvent = graph.nodes.find(
      (node) => node.kind === "Event" && node.sourceLocation?.file === "src/tickets/actions.ts",
    );

    expect(socialEvent).toBeDefined();
    expect(ticketsEvent).toBeDefined();

    if (!socialEvent || !ticketsEvent) {
      return;
    }

    expect(graph.edges).toContainEqual({
      source: "refreshListener",
      target: socialEvent.id,
      kind: "LISTENS_TO",
    });
    expect(graph.edges).not.toContainEqual({
      source: "refreshListener",
      target: ticketsEvent.id,
      kind: "LISTENS_TO",
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

  it("detects a State declared with createReducer", async () => {
    const file = "tests/fixtures/createReducerState.ts";
    const source = await readFile(
      new URL("../fixtures/createReducerState.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "likeWlReducer",
      kind: "State",
    });
  });

  it("detects an Event updating a State through createReducer addCase", async () => {
    const file = "tests/fixtures/createReducerUpdates.ts";
    const source = await readFile(
      new URL("../fixtures/createReducerUpdates.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "likeOptimisticApplied",
      target: "likeWlReducer",
      kind: "UPDATES",
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

  it("ignores an unresolved reducer Event without failing the scan", async () => {
    const file = "tests/fixtures/unresolvedReducerCase.ts";
    const source = await readFile(
      new URL("../fixtures/unresolvedReducerCase.ts", import.meta.url),
      "utf8",
    );
    let graph: ReturnType<typeof scanTypeScriptSource> | undefined;

    expect(() => {
      graph = scanTypeScriptSource({ file, source });
    }).not.toThrow();

    expect(graph?.edges).toContainEqual({
      source: "knownEvent",
      target: "stateReducer",
      kind: "UPDATES",
    });
    expect(graph?.edges).not.toContainEqual({
      source: "missingEvent",
      target: "stateReducer",
      kind: "UPDATES",
    });
  });

  it("uses the store registration name as State identity", async () => {
    const files = ["tests/fixtures/storeReducer.ts", "tests/fixtures/storeRegistration.ts"];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFile(
            new URL(`../fixtures/${file.split("/").pop()}`, import.meta.url),
            "utf8",
          ),
        })),
      ),
    });

    expect(graph.nodes).toContainEqual({
      id: "lState",
      kind: "State",
    });
  });
});
