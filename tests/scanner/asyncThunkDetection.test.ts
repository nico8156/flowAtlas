import { describe, expect, it } from "vitest";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";
import { readFixture } from "./fixtureSource.js";

describe("Redux async thunk detection", () => {
  it("maps a createAsyncThunk declaration to a Handler and lifecycle Events", async () => {
    const file = "tests/fixtures/asyncThunkLifecycle.ts";
    const source = await readFixture("asyncThunkLifecycle.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "login",
      kind: "Handler",
      sourceLocation: { file, line: 3 },
    });
    for (const lifecycle of ["pending", "fulfilled", "rejected"]) {
      expect(graph.nodes).toContainEqual({
        id: `login.${lifecycle}`,
        kind: "Event",
        sourceLocation: { file, line: 3 },
      });
      expect(graph.edges).toContainEqual({
        source: "login",
        target: `login.${lifecycle}`,
        kind: "DISPATCHES",
      });
    }
  });
});
