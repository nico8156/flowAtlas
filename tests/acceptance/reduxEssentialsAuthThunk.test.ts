import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const reduxEssentialsRoot = resolve(process.env.FLOWATLAS_REDUX_ESSENTIALS_ROOT ?? "");
const describeReduxEssentials =
  process.env.FLOWATLAS_REDUX_ESSENTIALS_ROOT &&
  existsSync(resolve(reduxEssentialsRoot, "tsconfig.json"))
    ? describe
    : describe.skip;

describeReduxEssentials("Redux Essentials auth thunk acceptance", () => {
  it("maps a typed async thunk to its Redux lifecycle Events and State", async () => {
    const loadedProject = await loadTypeScriptProject(reduxEssentialsRoot);
    const graph = scanTypeScriptProject(loadedProject.project);

    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: "login", kind: "Handler" }));
    for (const lifecycle of ["pending", "fulfilled", "rejected"]) {
      expect(graph.nodes).toContainEqual(
        expect.objectContaining({ id: `login.${lifecycle}`, kind: "Event" }),
      );
      expect(graph.edges).toContainEqual({
        source: "login",
        target: `login.${lifecycle}`,
        kind: "DISPATCHES",
      });
    }
    expect(graph.edges).toContainEqual({
      source: "login.fulfilled",
      target: "auth",
      kind: "UPDATES",
    });
    expect(graph.edges).not.toContainEqual({
      source: "login.pending",
      target: "auth",
      kind: "UPDATES",
    });
  }, 60_000);
});
