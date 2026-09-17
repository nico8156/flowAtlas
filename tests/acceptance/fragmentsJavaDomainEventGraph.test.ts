import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaDomainEventGraph } from "../../src/scanner/javaDomainEventDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const acceptedEvent =
  "java-domain-event:com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent";
const completedEvent =
  "java-domain-event:com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerificationCompletedEvent";
const handler =
  "com.nm.fragmentsclean.ticketContext.write.businesslogic.processManagers.TicketVerificationProcessManager";

describeFragments("Fragments Java domain-event graph", () => {
  it("projects a typed local handler and its statically proven publication", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-semantic-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as Parameters<typeof detectJavaDomainEventGraph>[0];
    const graph = detectJavaDomainEventGraph(evidence);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: acceptedEvent, kind: "Event" }),
        expect.objectContaining({ id: handler, kind: "Handler" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: handler, target: acceptedEvent, kind: "LISTENS_TO" }),
      ]),
    );

    expect(graph.findNode("TicketVerificationProvider")).toBeUndefined();
    expect(graph.findNode(completedEvent)).toBeUndefined();
    expect(graph.edges).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: handler, target: acceptedEvent, kind: "DISPATCHES" }),
        expect.objectContaining({ source: handler, target: completedEvent, kind: "DISPATCHES" }),
        expect.objectContaining({ source: handler, kind: "CALLS_EXTERNAL" }),
      ]),
    );
  }, 60_000);
});
