import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const describeFragments = existsSync(resolve(fragmentsRoot, "pom.xml")) ? describe : describe.skip;
const worker =
  "com.nm.fragmentsclean.ticketContext.write.adapters.primary.springboot.scheduling.ScheduledTicketVerificationWorker";

describeFragments("Fragments Java scheduled graph", () => {
  it("projects the scheduled worker signal without joining it to durable job intake", async () => {
    const { graph } = await createJavaMavenArchitectureScanner().scan({
      projectPath: fragmentsRoot,
      adapter: "java",
      requestPath: resolve(repositoryRoot, "tests/fixtures/fragments-java-external-request.json"),
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: worker,
          target: `protocol:scheduled:${worker}#runDue()`,
          kind: "LISTENS_TO",
        }),
      ]),
    );
    expect(
      graph.edges.some(
        (edge) =>
          edge.source.includes("TicketVerificationProcessManager") && edge.target.includes(worker),
      ),
    ).toBe(false);
  }, 60_000);
});
