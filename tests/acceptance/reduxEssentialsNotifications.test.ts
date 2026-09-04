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

describeReduxEssentials("Redux Essentials notifications acceptance", () => {
  it("maps the explicit notification action to its registered Redux state", async () => {
    const loadedProject = await loadTypeScriptProject(reduxEssentialsRoot);
    const graph = scanTypeScriptProject(loadedProject.project);

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: "notificationsReceived", kind: "Event" }),
    );
    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: "notifications", kind: "State" }),
    );
    expect(graph.edges).toContainEqual({
      source: "notificationsReceived",
      target: "notifications",
      kind: "UPDATES",
    });
    expect(graph.edges).not.toContainEqual({
      source: "notificationsReceived",
      target: "auth",
      kind: "UPDATES",
    });
  }, 60_000);
});
