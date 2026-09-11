import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const source = (relativePath: string) => resolve(fragmentsRoot, "src/main/java", relativePath);

describeFragments("Fragments Java semantic feasibility", () => {
  it("resolves the ticket verification event-handler-provider slice with Maven context", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "flowatlas-java-classpath-"));
    const classpathFile = resolve(temporaryDirectory, "classpath.txt");

    try {
      await execFileAsync(
        resolve(fragmentsRoot, "mvnw"),
        [
          "-q",
          "dependency:build-classpath",
          `-Dmdep.outputFile=${classpathFile}`,
          `-Dmdep.pathSeparator=${delimiter}`,
        ],
        { cwd: fragmentsRoot, maxBuffer: 1024 * 1024 },
      );
      const dependencyClasspath = (await readFile(classpathFile, "utf8")).trim();
      const classpath = [dependencyClasspath, resolve(fragmentsRoot, "target/classes")]
        .filter(Boolean)
        .join(delimiter);
      const sources = [
        source("com/nm/fragmentsclean/sharedKernel/businesslogic/models/DomainEvent.java"),
        source("com/nm/fragmentsclean/sharedKernel/businesslogic/models/event/EventHandler.java"),
        source(
          "com/nm/fragmentsclean/ticketContext/write/businesslogic/models/TicketVerifyAcceptedEvent.java",
        ),
        source(
          "com/nm/fragmentsclean/ticketContext/write/businesslogic/models/TicketVerificationCompletedEvent.java",
        ),
        source(
          "com/nm/fragmentsclean/ticketContext/write/businesslogic/gateways/TicketVerificationProvider.java",
        ),
        source(
          "com/nm/fragmentsclean/ticketContext/write/businesslogic/processManagers/TicketVerificationProcessManager.java",
        ),
      ];
      const { stdout } = await execFileAsync(
        "java",
        [
          "scripts/JavaSemanticSpike.java",
          "--release",
          "21",
          "--source-root",
          resolve(fragmentsRoot, "src/main/java"),
          "--classpath",
          classpath,
          "--domain-event",
          "com.nm.fragmentsclean.sharedKernel.businesslogic.models.DomainEvent",
          "--event-handler",
          "com.nm.fragmentsclean.sharedKernel.businesslogic.models.event.EventHandler",
          "--handler",
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.processManagers.TicketVerificationProcessManager",
          "--provider",
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.gateways.TicketVerificationProvider",
          "--provider-method",
          "verify",
          ...sources.flatMap((path) => ["--source", path]),
          "--event",
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent",
          "--event",
          "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerificationCompletedEvent",
        ],
        { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
      );
      const result = JSON.parse(stdout) as {
        types: Array<{ qualifiedName: string; assignableToDomainEvent: boolean }>;
        handler: { eventType: string };
        providerInvocations: Array<{ owner: string; method: string; caller: string }>;
        diagnostics: string[];
      };

      expect(result.diagnostics).toEqual([]);
      expect(result.types).toEqual([
        expect.objectContaining({
          qualifiedName:
            "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent",
          assignableToDomainEvent: true,
        }),
        expect.objectContaining({
          qualifiedName:
            "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerificationCompletedEvent",
          assignableToDomainEvent: true,
        }),
      ]);
      expect(result.handler.eventType).toBe(
        "com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent",
      );
      expect(result.providerInvocations).toEqual([
        {
          owner:
            "com.nm.fragmentsclean.ticketContext.write.businesslogic.gateways.TicketVerificationProvider",
          method: "verify(java.lang.String,java.lang.String)",
          caller:
            "com.nm.fragmentsclean.ticketContext.write.businesslogic.processManagers.TicketVerificationProcessManager#handle(com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent)",
          source: expect.objectContaining({
            file: "com/nm/fragmentsclean/ticketContext/write/businesslogic/processManagers/TicketVerificationProcessManager.java",
            line: expect.any(Number),
          }),
        },
      ]);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }, 60_000);
});
