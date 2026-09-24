import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_MOBILE_ROOT ?? "../dogsout/mobile");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeDogsOut("Dogs Out Redux authentication events", () => {
  it("maps the event factory callbacks to authentication state events", async () => {
    const loadedProject = await loadTypeScriptProject(dogsOutRoot);
    const graph = scanTypeScriptProject(loadedProject.project);

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: "createAuthenticationEvents", kind: "Handler" }),
    );
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
  }, 120_000);
});
