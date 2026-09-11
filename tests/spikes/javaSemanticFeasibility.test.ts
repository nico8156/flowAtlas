import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureSourceRoot = resolve(
  repositoryRoot,
  "tests/fixtures/java-semantic-project/src/main/java",
);

const findJavaSources = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findJavaSources(path)));
    else if (entry.name.endsWith(".java")) files.push(path);
  }

  return files;
};

type SemanticProbe = {
  engine: string;
  types: Array<{
    qualifiedName: string;
    assignableToDomainEvent: boolean;
    source: { file: string; line: number };
  }>;
  handler: {
    qualifiedName: string;
    eventType: string;
    source: { file: string; line: number };
  };
  providerInvocations: Array<{
    owner: string;
    method: string;
    caller: string;
    source: { file: string; line: number };
  }>;
};

describe("Java semantic feasibility spike", () => {
  it("resolves event types, a generic handler, and its provider call by symbol identity", async () => {
    const sources = await findJavaSources(fixtureSourceRoot);
    const arguments_ = [
      "scripts/JavaSemanticSpike.java",
      "--release",
      "21",
      "--source-root",
      fixtureSourceRoot,
      "--domain-event",
      "fixture.shared.DomainEvent",
      "--event-handler",
      "fixture.shared.EventHandler",
      "--handler",
      "fixture.application.TicketVerificationProcessManager",
      "--provider",
      "fixture.ports.TicketVerificationProvider",
      "--provider-method",
      "verify",
      ...sources.flatMap((source) => ["--source", source]),
      "--event",
      "fixture.events.TicketVerifyAcceptedEvent",
      "--event",
      "fixture.events.TicketVerificationCompletedEvent",
      "--event",
      "fixture.events.ConventionOnlyEvent",
    ];

    const { stdout } = await execFileAsync("java", arguments_, {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    });
    const result = JSON.parse(stdout) as SemanticProbe;

    expect(result.engine).toBe("jdk-compiler-api");
    expect(result.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          qualifiedName: "fixture.events.TicketVerifyAcceptedEvent",
          assignableToDomainEvent: true,
        }),
        expect.objectContaining({
          qualifiedName: "fixture.events.TicketVerificationCompletedEvent",
          assignableToDomainEvent: true,
        }),
        expect.objectContaining({
          qualifiedName: "fixture.events.ConventionOnlyEvent",
          assignableToDomainEvent: false,
        }),
      ]),
    );
    expect(result.handler).toEqual(
      expect.objectContaining({
        qualifiedName: "fixture.application.TicketVerificationProcessManager",
        eventType: "fixture.events.TicketVerifyAcceptedEvent",
      }),
    );
    expect(result.providerInvocations).toEqual([
      expect.objectContaining({
        owner: "fixture.ports.TicketVerificationProvider",
        method: "verify(java.lang.String,java.lang.String)",
        caller:
          "fixture.application.TicketVerificationProcessManager#handle(fixture.events.TicketVerifyAcceptedEvent)",
      }),
    ]);

    for (const evidence of [...result.types, result.handler, ...result.providerInvocations]) {
      expect(evidence.source.file).toMatch(/\.java$/);
      expect(evidence.source.line).toBeGreaterThan(0);
    }
  }, 30_000);
});
