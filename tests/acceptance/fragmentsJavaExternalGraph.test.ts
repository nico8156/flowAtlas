import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaExternalGraph } from "../../src/scanner/javaExternalDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const processManager =
  "com.nm.fragmentsclean.ticketContext.write.businesslogic.processManagers.TicketVerificationProcessManager#handle(com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent)";

describeFragments("Fragments Java external graph", () => {
  it("proves the verification process manager reaches a resolved local-process boundary", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-external-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as Parameters<typeof detectJavaExternalGraph>[0];
    const graph = detectJavaExternalGraph(evidence);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: processManager, kind: "Handler" }),
        expect.objectContaining({ id: "local-process:java.lang.ProcessBuilder", kind: "External" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: processManager,
          target: "local-process:java.lang.ProcessBuilder",
          kind: "CALLS_EXTERNAL",
        }),
      ]),
    );
    expect(
      graph.nodes.some((node) => /TicketVerificationProvider|ProcessBuilderTicket/u.test(node.id)),
    ).toBe(false);
  }, 60_000);
});
