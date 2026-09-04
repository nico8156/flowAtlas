import { describe, expect, it } from "vitest";

import { readFixture } from "./fixtureSource.js";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";

describe("Thunk Handler detection", () => {
  it("detects a dispatchable thunk factory as a Handler", async () => {
    const source = await readFixture("thunkHandler.ts");

    const graph = scanTypeScriptSource({
      file: "tests/fixtures/thunkHandler.ts",
      source,
    });

    expect(graph.nodes).toContainEqual({
      id: "likesRetrieval",
      kind: "Handler",
      sourceLocation: {
        file: "tests/fixtures/thunkHandler.ts",
        line: 1,
      },
    });
  });

  it("detects an Event dispatched by a thunk Handler", async () => {
    const source = await readFixture("thunkDispatch.ts");

    const graph = scanTypeScriptSource({
      file: "tests/fixtures/thunkDispatch.ts",
      source,
    });

    expect(graph.edges).toContainEqual({
      source: "likesRetrieval",
      target: "likesRetrievalPending",
      kind: "DISPATCHES",
    });
  });
});
