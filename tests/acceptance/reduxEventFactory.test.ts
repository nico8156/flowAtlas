import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

describe("Redux event factory", () => {
  it("maps callback dispatches to createSlice action events and state", async () => {
    const file = "reduxEventFactory.ts";
    const source = await readFile(resolve(import.meta.dirname, "../fixtures", file), "utf8");
    const graph = scanTypeScriptProject({ files: [{ file, source }] });

    expect(graph.edges).toContainEqual({
      source: "createAuthenticationEvents",
      target: "sessionAuthenticated",
      kind: "DISPATCHES",
    });
    expect(graph.edges).toContainEqual({
      source: "sessionAuthenticated",
      target: "authenticationSlice",
      kind: "UPDATES",
    });
  });
});
