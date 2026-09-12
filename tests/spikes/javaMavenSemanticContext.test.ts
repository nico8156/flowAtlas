import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");

type SourceLocation = {
  file: string;
  line: number;
  inScanScope: boolean;
};

describe("Java Maven semantic context", () => {
  it("resolves through the full project while keeping evidence and diagnostics scope-aware", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fixtureRoot,
        resolve(fixtureRoot, "flowatlas-java-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const result = JSON.parse(stdout) as {
      engine: string;
      project: {
        root: string;
        javaRelease: string;
        javaRuntime: { executable: string; version: string; feature: string };
        sourceRoot: string;
        classpathEntries: number;
      };
      scanScope: { files: string[] };
      types: Array<{
        qualifiedName: string;
        assignableToDomainEvent: boolean;
        source: SourceLocation;
      }>;
      handler: { qualifiedName: string; eventType: string; source: SourceLocation };
      providerInvocations: Array<{ source: SourceLocation }>;
      domainEventPublications: Array<{
        owner: string;
        method: string;
        caller: string;
        argumentType: string;
        source: SourceLocation;
      }>;
      diagnostics: Array<{
        kind: string;
        message: string;
        source?: SourceLocation;
      }>;
    };

    expect(result.engine).toBe("jdk-compiler-api");
    expect(result.project).toEqual({
      root: fixtureRoot,
      javaRelease: "21",
      javaRuntime: {
        executable: expect.any(String),
        version: expect.any(String),
        feature: expect.any(String),
      },
      sourceRoot: "src/main/java",
      classpathEntries: expect.any(Number),
    });
    expect(result.project.classpathEntries).toBeGreaterThan(0);
    expect(result.scanScope.files).toEqual([
      "fixture/application/BrokenHandler.java",
      "fixture/application/TicketVerificationProcessManager.java",
    ]);

    expect(result.handler.source.inScanScope).toBe(true);
    expect(result.providerInvocations[0]?.source.inScanScope).toBe(true);
    expect(result.domainEventPublications).toEqual([
      expect.objectContaining({
        owner: "fixture.shared.DomainEventPublisher",
        method: "publish(fixture.shared.DomainEvent)",
        caller:
          "fixture.application.TicketVerificationProcessManager#handle(fixture.events.TicketVerifyAcceptedEvent)",
        argumentType: "fixture.events.TicketVerificationCompletedEvent",
        source: expect.objectContaining({ inScanScope: true }),
      }),
    ]);
    expect(result.types).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          qualifiedName: "fixture.events.TicketVerifyAcceptedEvent",
          assignableToDomainEvent: true,
          source: expect.objectContaining({ inScanScope: false }),
        }),
        expect.objectContaining({
          qualifiedName: "fixture.events.ConventionOnlyEvent",
          assignableToDomainEvent: false,
          source: expect.objectContaining({ inScanScope: false }),
        }),
      ]),
    );
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ERROR",
          message: expect.stringMatching(/missing\.Dependency|package missing/),
          source: expect.objectContaining({
            file: "fixture/application/BrokenHandler.java",
            inScanScope: true,
          }),
        }),
      ]),
    );
    expect(result).not.toHaveProperty("nodes");
    expect(result).not.toHaveProperty("edges");
  }, 30_000);
});
