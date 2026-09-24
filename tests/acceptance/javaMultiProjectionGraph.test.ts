import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");

describe("Java multi-projection handler", () => {
  it("maps each configured read model updated by one handler", async () => {
    const requestPath = resolve(
      repositoryRoot,
      "tests/fixtures/java-multi-projection-request.json",
    );
    const { graph, diagnostics } = await createJavaMavenArchitectureScanner().scan({
      projectPath: fixtureRoot,
      requestPath,
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "java-domain-event:fixture.local.Started",
          target: "dailyWalkGoal",
          kind: "UPDATES",
        }),
        expect.objectContaining({
          source: "java-domain-event:fixture.local.Started",
          target: "dailyWalkProgress",
          kind: "UPDATES",
        }),
      ]),
    );
    expect(diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  }, 120_000);
});
