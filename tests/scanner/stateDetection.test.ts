import { describe, expect, it } from "vitest";

import { readFixture } from "./fixtureSource.js";

import {
  scanTypeScriptProject,
  scanTypeScriptSource,
} from "../../src/scanner/typeScriptScanner.js";
describe("State detection", () => {
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

  it("detects a State declared with createReducer", async () => {
    const file = "tests/fixtures/createReducerState.ts";
    const source = await readFixture("createReducerState.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "likeWlReducer",
      kind: "State",
    });
  });

  it("detects an Event updating a State through createReducer addCase", async () => {
    const file = "tests/fixtures/createReducerUpdates.ts";
    const source = await readFixture("createReducerUpdates.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "likeOptimisticApplied",
      target: "likeWlReducer",
      kind: "UPDATES",
    });
  });

  it("detects an explicit Event inside an isAnyOf reducer matcher", async () => {
    const file = "tests/fixtures/matcherUpdates.ts";
    const source = await readFixture("matcherUpdates.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "notificationsReceived",
      target: "notificationsSlice",
      kind: "UPDATES",
    });
  });

  it("detects an Event from an extraReducers object method", async () => {
    const file = "tests/fixtures/methodExtraReducers.ts";
    const source = await readFixture("methodExtraReducers.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "notificationsReceived",
      target: "notificationsSlice",
      kind: "UPDATES",
    });
  });

  it("ignores an unresolved reducer Event without failing the scan", async () => {
    const file = "tests/fixtures/unresolvedReducerCase.ts";
    const source = await readFixture("unresolvedReducerCase.ts");
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

  it("uses the aliased shorthand store property as State identity", async () => {
    const files = [
      "tests/fixtures/aliasedStoreReducer.ts",
      "tests/fixtures/aliasedStoreRegistration.ts",
    ];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFixture(file.split("/").pop() ?? ""),
        })),
      ),
    });

    expect(graph.nodes).toContainEqual({
      id: "lState",
      kind: "State",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "likeWlReducer",
      kind: "State",
    });
    expect(graph.edges).toContainEqual({
      source: "likeOptimisticApplied",
      target: "lState",
      kind: "UPDATES",
    });
  });

  it("uses the store registration name as State identity", async () => {
    const files = ["tests/fixtures/storeReducer.ts", "tests/fixtures/storeRegistration.ts"];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFixture(file.split("/").pop() ?? ""),
        })),
      ),
    });

    expect(graph.nodes).toContainEqual({
      id: "lState",
      kind: "State",
    });
  });

  it("uses the store name for a reducer imported through a default export", async () => {
    const files = [
      "tests/fixtures/defaultExportReducer.ts",
      "tests/fixtures/defaultExportReducerStore.ts",
    ];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFixture(file.split("/").pop() ?? ""),
        })),
      ),
    });

    expect(graph.nodes).toContainEqual({ id: "notifications", kind: "State" });
    expect(graph.nodes).not.toContainEqual({ id: "notificationsSlice", kind: "State" });
  });
});
