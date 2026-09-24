import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_MOBILE_ROOT ?? "../dogsout/mobile");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeDogsOut("Dogs Out Redux onboarding", () => {
  it("maps the typed onboarding thunk to its gateway boundaries and lifecycle", async () => {
    const loadedProject = await loadTypeScriptProject(dogsOutRoot);
    const graph = scanTypeScriptProject(loadedProject.project);

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({ id: "loadOnboarding", kind: "Handler" }),
    );
    expect(graph.edges).toContainEqual({
      source: "loadOnboarding",
      target: "OnboardingGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "loadOnboarding",
      target: "SessionVault",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "loadOnboarding",
      target: "loadOnboarding.fulfilled",
      kind: "DISPATCHES",
    });
    expect(graph.edges).not.toContainEqual({
      source: "loadOnboarding.fulfilled",
      target: "dog",
      kind: "UPDATES",
    });
  }, 120_000);
});
