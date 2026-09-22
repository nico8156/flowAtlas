import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_BACKEND_ROOT ?? "../dogsout/backend");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "pom.xml")) ? describe : describe.skip;

describeDogsOut("Dogs Out SES boundary", () => {
  it("maps the delivery service to the resolved SES client without joining an outbox route", async () => {
    const { graph, diagnostics } = await createJavaMavenArchitectureScanner().scan({
      projectPath: dogsOutRoot,
      requestPath: resolve(
        repositoryRoot,
        "tests/fixtures/dogs-out-java-ses-external-request.json",
      ),
    });

    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source:
          "com.nm.dogsout.identity.application.delivermagiclink.DeliverMagicLinkService#deliver(com.nm.dogsout.identity.domain.MagicLinkChallengeId)",
        target: "java-client:software.amazon.awssdk.services.sesv2.SesV2Client#sendEmail",
        kind: "CALLS_EXTERNAL",
      }),
    );
    expect(
      graph.edges.some((edge) => edge.kind === "LISTENS_TO" || edge.kind === "DISPATCHES"),
    ).toBe(false);
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  }, 120_000);
});
