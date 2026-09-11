import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");
const requestPath = resolve(fixtureRoot, "flowatlas-java-external-request.json");

describe("Java external semantic context", () => {
  it("proves a configured port adapter reaches ProcessBuilder.start", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/javaMavenSemanticContext.mjs", fixtureRoot, requestPath],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as { externalCalls: Array<Record<string, unknown>> };

    expect(evidence.externalCalls).toEqual([
      expect.objectContaining({
        handler:
          "fixture.application.TicketVerificationProcessManager#handle(fixture.events.TicketVerifyAcceptedEvent)",
        adapter: "fixture.adapters.ProcessVerificationProvider",
        external: "local-process:java.lang.ProcessBuilder",
      }),
    ]);
  }, 30_000);
});
