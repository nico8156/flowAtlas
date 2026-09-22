import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaProjectionGraph } from "../../src/scanner/javaProjectionDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");

describe("unmarked Java projection", () => {
  it("maps an event-derived view without a marker or unrelated request blocks", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-unmarked-projection-"));
    try {
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: ["fixture/local/StartedProjection.java"],
          resolutionSources: [
            "fixture/local/Started.java",
            "fixture/local/CurrentView.java",
            "fixture/local/SaveCurrentViewPort.java",
          ],
          projectionHandler: "fixture.local.StartedProjection",
          projectionHandlerMethod: "handle",
          projectionRepository: "fixture.local.SaveCurrentViewPort",
          projectionMutationMethod: "upsert",
          projectionState: "currentViews",
        }),
      );
      const { stdout } = await execFileAsync(
        "node",
        ["scripts/javaMavenSemanticContext.mjs", fixtureRoot, requestPath],
        { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
      );
      const graph = detectJavaProjectionGraph(JSON.parse(stdout));

      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          source: "java-domain-event:fixture.local.Started",
          target: "currentViews",
          kind: "UPDATES",
        }),
      );
      expect(graph.nodes.some((node) => node.id.startsWith("sync:"))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
