import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { findArchitectureNodes } from "../../src/application/architectureNodeDiscovery.js";
import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const describeFragments = existsSync(resolve(fragmentsRoot, "pom.xml")) ? describe : describe.skip;

describeFragments("Fragments Java integration-event discovery", () => {
  it("discovers the stable integration contract from its Java producer event type", async () => {
    const result = await createJavaMavenArchitectureScanner().scan({
      projectPath: fragmentsRoot,
      adapter: "java",
      requestPath: resolve(
        repositoryRoot,
        "tests/fixtures/fragments-java-integration-event-request.json",
      ),
    });

    const discovery = findArchitectureNodes(
      result.graph,
      "TicketVerifyAcceptedEvent",
      ["Event"],
      5,
      result.discoveryAliases,
    );

    expect(discovery.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "integration:ticket-events:ticket.verify.accepted:v1" }),
        expect.objectContaining({
          id: "integration:ticket-verification-requested:ticket.verify.accepted:v1",
        }),
      ]),
    );
  }, 60_000);
});
