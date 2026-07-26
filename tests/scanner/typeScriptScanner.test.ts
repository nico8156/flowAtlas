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
});
