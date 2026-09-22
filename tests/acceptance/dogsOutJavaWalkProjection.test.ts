import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_BACKEND_ROOT ?? "../dogsout/backend");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "pom.xml")) ? describe : describe.skip;

describeDogsOut("Dogs Out WalkStarted projection", () => {
  it("maps its local event-fed view without a sync signal", async () => {
    const { graph, diagnostics } = await createJavaMavenArchitectureScanner().scan({
      projectPath: dogsOutRoot,
      requestPath: resolve(
        repositoryRoot,
        "tests/fixtures/dogs-out-java-walk-projection-request.json",
      ),
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "java-domain-event:com.nm.dogsout.walk.domain.WalkStarted",
          target: "CurrentWalkView",
          kind: "UPDATES",
        }),
      ]),
    );
    expect(graph.nodes.some((node) => node.id.startsWith("sync:"))).toBe(false);
    expect(graph.nodes.some((node) => node.id.includes("LocalOutboxDispatcher"))).toBe(false);
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  }, 120_000);
});
