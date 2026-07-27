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

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "likesRetrieval",
        kind: "Handler",
      }),
    );
  });
});
