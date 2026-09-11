import { describe, expect, it } from "vitest";

import { detectJavaExternalGraph } from "../../src/scanner/javaExternalDetector.js";

const inScope = (file: string, line: number) => ({ file, line, inScanScope: true });

describe("Java external detector", () => {
  it("projects a handler port invocation only when its configured adapter starts a local process", () => {
    const graph = detectJavaExternalGraph({
      externalCalls: [
        {
          handler: "fixture.application.VerifyHandler#handle(fixture.events.Accepted)",
          port: "fixture.ports.VerificationProvider",
          adapter: "fixture.adapters.ProcessVerificationProvider",
          external: "local-process:java.lang.ProcessBuilder",
          handlerSource: inScope("fixture/application/VerifyHandler.java", 20),
          factorySource: inScope("fixture/config/Dependencies.java", 14),
          adapterSource: inScope("fixture/adapters/ProcessVerificationProvider.java", 10),
          externalSource: inScope("fixture/adapters/ProcessVerificationProvider.java", 24),
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "fixture.application.VerifyHandler#handle(fixture.events.Accepted)",
          kind: "Handler",
        }),
        expect.objectContaining({ id: "local-process:java.lang.ProcessBuilder", kind: "External" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "fixture.application.VerifyHandler#handle(fixture.events.Accepted)",
          target: "local-process:java.lang.ProcessBuilder",
          kind: "CALLS_EXTERNAL",
        }),
      ]),
    );
    expect(graph.nodes.some((node) => /VerificationProvider|Dependencies/u.test(node.id))).toBe(
      false,
    );
  });

  it("omits the relation when adapter execution evidence is out of scan scope", () => {
    const graph = detectJavaExternalGraph({
      externalCalls: [
        {
          handler: "fixture.application.VerifyHandler#handle(fixture.events.Accepted)",
          port: "fixture.ports.VerificationProvider",
          adapter: "fixture.adapters.ProcessVerificationProvider",
          external: "local-process:java.lang.ProcessBuilder",
          handlerSource: inScope("fixture/application/VerifyHandler.java", 20),
          factorySource: inScope("fixture/config/Dependencies.java", 14),
          adapterSource: inScope("fixture/adapters/ProcessVerificationProvider.java", 10),
          externalSource: {
            file: "fixture/adapters/ProcessVerificationProvider.java",
            line: 24,
            inScanScope: false,
          },
        },
      ],
    });

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
