import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");
const requestPath = resolve(fixtureRoot, "flowatlas-java-projection-request.json");

describe("Java projection semantic context", () => {
  it("proves one event-fed projection mutation and direct sync publication", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/javaMavenSemanticContext.mjs", fixtureRoot, requestPath],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as { projectionUpdates: Array<Record<string, unknown>> };

    expect(evidence.projectionUpdates).toEqual([
      expect.objectContaining({
        handler:
          "fixture.projection.TicketVerifyAcceptedProjection#handle(fixture.events.TicketVerifyAcceptedEvent)",
        eventType: "fixture.events.TicketVerifyAcceptedEvent",
        projection: "tickets",
        scope: "entity",
      }),
    ]);
  }, 30_000);
});
