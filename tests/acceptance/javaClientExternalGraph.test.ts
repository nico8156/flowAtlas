import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/java-semantic-project");

describe("Java client external boundary", () => {
  it("maps a configured adapter call to a resolved external client", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-client-external-"));
    try {
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: [
            "fixture/outbound/SenderService.java",
            "fixture/outbound/HttpSendConfiguration.java",
            "fixture/outbound/HttpSendAdapter.java",
          ],
          resolutionSources: ["fixture/outbound/SendPort.java"],
          externalConfiguration: "fixture.outbound.HttpSendConfiguration",
          externalFactoryMethod: "sender",
          externalAdapter: "fixture.outbound.HttpSendAdapter",
          externalAdapterMethod: "send",
          externalHandler: "fixture.outbound.SenderService",
          externalPort: "fixture.outbound.SendPort",
          externalPortMethod: "send",
          externalClient: "java.net.http.HttpClient",
          externalClientMethod: "send",
        }),
      );
      const { graph } = await createJavaMavenArchitectureScanner().scan({
        projectPath: fixtureRoot,
        requestPath,
      });

      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          source: "fixture.outbound.SenderService#deliver(java.net.http.HttpRequest)",
          target: "java-client:java.net.http.HttpClient#send",
          kind: "CALLS_EXTERNAL",
        }),
      );
      expect(graph.nodes.some((node) => node.id === "fixture.outbound.SendPort")).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);

  it("maps a client method bound through a constructor and functional field", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-bound-client-external-"));
    try {
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: [
            "fixture/outbound/SenderService.java",
            "fixture/outbound/BoundClientConfiguration.java",
            "fixture/outbound/BoundClientAdapter.java",
          ],
          resolutionSources: [
            "fixture/outbound/SendPort.java",
            "fixture/outbound/RemoteClient.java",
          ],
          externalConfiguration: "fixture.outbound.BoundClientConfiguration",
          externalFactoryMethod: "sender",
          externalAdapter: "fixture.outbound.BoundClientAdapter",
          externalAdapterMethod: "send",
          externalHandler: "fixture.outbound.SenderService",
          externalPort: "fixture.outbound.SendPort",
          externalPortMethod: "send",
          externalClient: "fixture.outbound.RemoteClient",
          externalClientMethod: "transmit",
        }),
      );
      const { graph } = await createJavaMavenArchitectureScanner().scan({
        projectPath: fixtureRoot,
        requestPath,
      });

      expect(graph.edges).toContainEqual(
        expect.objectContaining({
          source: "fixture.outbound.SenderService#deliver(java.net.http.HttpRequest)",
          target: "java-client:fixture.outbound.RemoteClient#transmit",
          kind: "CALLS_EXTERNAL",
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
