import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildArchitectureContext } from "../../src/application/architectureContext.js";
import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_MOBILE_ROOT ?? "../dogsout/mobile");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeDogsOut("Dogs Out Redux bounded context", () => {
  it("states that graph completeness does not certify application coverage", async () => {
    const loadedProject = await loadTypeScriptProject(dogsOutRoot);
    const graph = scanTypeScriptProject(loadedProject.project);
    const context = buildArchitectureContext(graph, "dogSlice", "both", 3, {
      maxNodes: 20,
      maxEdges: 30,
      maxBytes: 16_384,
    });

    expect(context.coverage).toEqual({
      graph: "bounded-projection",
      application: "not-assessed",
    });
    expect(context.complete).toBe(true);
    expect(context.projection.nodes).toContainEqual(
      expect.objectContaining({ id: "dogSlice", kind: "State" }),
    );
  }, 120_000);
});
