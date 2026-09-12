import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Java semantic feasibility", () => {
  it("loads the ticket process manager with full Maven context and bounded scan scope", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-semantic-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const result = JSON.parse(stdout) as {
      project: { javaRelease: string };
      scanScope: { files: string[] };
      types: Array<{
        qualifiedName: string;
        assignableToDomainEvent: boolean;
        source: { inScanScope: boolean };
      }>;
      handler: { eventType: string; source: { inScanScope: boolean } };
      providerInvocations: Array<{
        owner: string;
        method: string;
        caller: string;
        source: { file: string; line: number; inScanScope: boolean };
      }>;
      diagnostics: Array<{ kind: string; message: string }>;
    };

    expect(result.project.javaRelease).toBe("21");
    expect(result.scanScope.files).toEqual([
      "com/nm/fragmentsclean/ticketContext/write/businesslogic/processManagers/TicketVerificationProcessManager.java",
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.types).toEqual([
      expect.objectContaining({
        qualifiedName:
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent",
        assignableToDomainEvent: true,
        source: expect.objectContaining({ inScanScope: false }),
      }),
      expect.objectContaining({
        qualifiedName:
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerificationCompletedEvent",
        assignableToDomainEvent: true,
        source: expect.objectContaining({ inScanScope: false }),
      }),
    ]);
    expect(result.handler).toEqual(
      expect.objectContaining({
        eventType:
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent",
        source: expect.objectContaining({ inScanScope: true }),
      }),
    );
    // The durable intake records a job; provider execution belongs to the scheduled worker.
    expect(result.providerInvocations).toEqual([]);
  }, 60_000);
});
