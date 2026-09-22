import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");

describe("local Java outbox handler", () => {
  it("listens to its constant contract without joining an unproven producer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-local-outbox-"));
    try {
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: [
            "fixture/outbox/RequestedHandler.java",
            "fixture/outbox/LocalDispatcher.java",
          ],
          resolutionSources: [
            "fixture/outbox/LocalHandler.java",
            "fixture/outbox/LocalMessage.java",
          ],
          localOutboxHandler: "fixture.outbox.RequestedHandler",
          localOutboxHandlerInterface: "fixture.outbox.LocalHandler",
          localOutboxEventTypeMethod: "eventType",
          localOutboxHandleMethod: "handle",
          localOutboxDispatcher: "fixture.outbox.LocalDispatcher",
          localOutboxDispatchMethod: "dispatch",
        }),
      );
      const { graph } = await createJavaMavenArchitectureScanner().scan({
        projectPath: fixtureRoot,
        requestPath,
      });

      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          source: "fixture.outbox.RequestedHandler#handle(fixture.outbox.LocalMessage)",
          target: "local-outbox:Requested",
          kind: "LISTENS_TO",
        }),
      );
      expect(graph.edges.some((edge) => edge.kind === "DISPATCHES")).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);

  it("requires a configured dispatcher before claiming a local listener", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-local-outbox-unwired-"));
    try {
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: ["fixture/outbox/RequestedHandler.java"],
          resolutionSources: [
            "fixture/outbox/LocalHandler.java",
            "fixture/outbox/LocalMessage.java",
          ],
          localOutboxHandler: "fixture.outbox.RequestedHandler",
          localOutboxHandlerInterface: "fixture.outbox.LocalHandler",
          localOutboxEventTypeMethod: "eventType",
          localOutboxHandleMethod: "handle",
        }),
      );
      await expect(
        createJavaMavenArchitectureScanner().scan({ projectPath: fixtureRoot, requestPath }),
      ).rejects.toThrow("local outbox handler request properties");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
