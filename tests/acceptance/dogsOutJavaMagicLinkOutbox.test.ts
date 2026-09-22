import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_BACKEND_ROOT ?? "../dogsout/backend");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "pom.xml")) ? describe : describe.skip;

describeDogsOut("Dogs Out magic-link outbox", () => {
  it("maps the configured local consumer without inventing publication or external execution", async () => {
    const { graph, diagnostics } = await createJavaMavenArchitectureScanner().scan({
      projectPath: dogsOutRoot,
      requestPath: resolve(
        repositoryRoot,
        "tests/fixtures/dogs-out-java-magic-link-outbox-request.json",
      ),
    });

    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source:
          "com.nm.dogsout.identity.infrastructure.eventing.MagicLinkDeliveryRequestedOutboxHandler#handle(com.nm.dogsout.platform.infrastructure.eventing.LocalOutboxMessage)",
        target: "local-outbox:MagicLinkDeliveryRequested",
        kind: "LISTENS_TO",
      }),
    );
    expect(graph.edges.some((edge) => edge.kind === "DISPATCHES")).toBe(false);
    expect(graph.edges.some((edge) => edge.kind === "CALLS_EXTERNAL")).toBe(false);
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  }, 120_000);
});
