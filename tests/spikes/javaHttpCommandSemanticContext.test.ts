import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");

describe("Java HTTP command semantic context", () => {
  it("resolves endpoint annotations, the dispatched command and its typed handler", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fixtureRoot,
        resolve(fixtureRoot, "flowatlas-java-http-command-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const result = JSON.parse(stdout) as {
      command: { qualifiedName: string; assignableToCommand: boolean };
      commandHandler: { qualifiedName: string; commandType: string };
      httpEndpoint: {
        controller: string;
        handler: string;
        httpMethod: string;
        path: string;
        source: { inScanScope: boolean };
      };
      commandDispatches: Array<{
        caller: string;
        argumentType: string;
        source: { inScanScope: boolean };
      }>;
      diagnostics: unknown[];
    };

    expect(result.diagnostics).toEqual([]);
    expect(result.command).toEqual(
      expect.objectContaining({
        qualifiedName: "fixture.commands.VerifyTicketCommand",
        assignableToCommand: true,
      }),
    );
    expect(result.commandHandler).toEqual(
      expect.objectContaining({
        qualifiedName: "fixture.application.VerifyTicketCommandHandler",
        commandType: "fixture.commands.VerifyTicketCommand",
      }),
    );
    expect(result.httpEndpoint).toEqual(
      expect.objectContaining({
        controller: "fixture.http.WriteTicketController",
        handler: "fixture.http.WriteTicketController#verify()",
        httpMethod: "POST",
        path: "/api/tickets/verify",
        source: expect.objectContaining({ inScanScope: true }),
      }),
    );
    expect(result.commandDispatches).toEqual([
      expect.objectContaining({
        caller: "fixture.http.WriteTicketController#verify()",
        argumentType: "fixture.commands.VerifyTicketCommand",
        source: expect.objectContaining({ inScanScope: true }),
      }),
    ]);
  }, 30_000);
});
