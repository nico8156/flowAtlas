import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaProjectionGraph } from "../../src/scanner/javaProjectionDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const accepted =
  "java-domain-event:com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent";
const projectionHandler =
  "com.nm.fragmentsclean.ticketContext.read.projections.TicketVerifyAcceptedEventHandler#handle(com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent)";

describeFragments("Fragments Java projection graph", () => {
  it("projects the ticket application state and direct projection-sync signal", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-projection-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as Parameters<typeof detectJavaProjectionGraph>[0];
    const graph = detectJavaProjectionGraph(evidence);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: accepted, kind: "Event" }),
        expect.objectContaining({ id: projectionHandler, kind: "Handler" }),
        expect.objectContaining({ id: "tickets", kind: "State" }),
        expect.objectContaining({ id: "sync:tickets:entity", kind: "Event" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: accepted, target: "tickets", kind: "UPDATES" }),
        expect.objectContaining({
          source: projectionHandler,
          target: "sync:tickets:entity",
          kind: "DISPATCHES",
        }),
        expect.objectContaining({
          source: "sync:tickets:entity",
          target: "tickets",
          kind: "UPDATES",
        }),
      ]),
    );
    expect(
      graph.nodes.some((node) => /Jdbc|Repository|ProjectionSyncPublisher/u.test(node.id)),
    ).toBe(false);
  }, 60_000);
});
