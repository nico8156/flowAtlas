import { describe, expect, it, vi } from "vitest";

import type { ArchitectureScanner } from "../../src/application/architectureScanner.js";
import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createJavaArchitectureScanner } from "../../src/scanner/javaArchitectureScanner.js";
import { createTypeScriptArchitectureScanner } from "../../src/scanner/typeScriptArchitectureScanner.js";

const scan = async (scanner: ArchitectureScanner, projectPath: string) =>
  scanner.scan({ projectPath });

describe("Architecture scanner port", () => {
  it("keeps TypeScript and Java mechanics behind one asynchronous application contract", async () => {
    const typeScriptGraph = createArchitectureGraph();
    typeScriptGraph.addNode({ id: "uiRequested", kind: "Event" });
    const loadTypeScriptGraph = vi.fn(async () => typeScriptGraph);
    const typeScriptResult = await scan(
      createTypeScriptArchitectureScanner(loadTypeScriptGraph),
      "/workspace/front",
    );

    const loadJavaEvidence = vi.fn(async () => ({
      types: [
        {
          qualifiedName: "fixture.AcceptedEvent",
          assignableToDomainEvent: true,
          source: { file: "fixture/AcceptedEvent.java", line: 3, inScanScope: false },
        },
      ],
      handler: {
        qualifiedName: "fixture.AcceptedHandler",
        eventType: "fixture.AcceptedEvent",
        source: { file: "fixture/AcceptedHandler.java", line: 5, inScanScope: true },
      },
      domainEventPublications: [],
      command: {
        qualifiedName: "fixture.VerifyCommand",
        assignableToCommand: true,
        source: { file: "fixture/VerifyCommand.java", line: 3, inScanScope: false },
      },
      commandHandler: {
        qualifiedName: "fixture.VerifyCommandHandler",
        commandType: "fixture.VerifyCommand",
        source: { file: "fixture/VerifyCommandHandler.java", line: 5, inScanScope: true },
      },
      httpEndpoint: {
        controller: "fixture.VerifyController",
        handler: "fixture.VerifyController#verify()",
        httpMethod: "POST",
        path: "/verify",
        source: { file: "fixture/VerifyController.java", line: 7, inScanScope: true },
      },
      commandDispatches: [
        {
          owner: "fixture.CommandBus",
          method: "dispatch(fixture.Command)",
          caller: "fixture.VerifyController#verify()",
          argumentType: "fixture.VerifyCommand",
          source: { file: "fixture/VerifyController.java", line: 9, inScanScope: true },
        },
      ],
      integrationEventMappings: [
        {
          producerEvent: "fixture.AcceptedEvent",
          aggregateType: "Fixture",
          destination: "fixture-events",
          eventType: "fixture.accepted",
          version: 1,
          sender: "fixture.StableSender#send(fixture.OutboxEvent)",
          senderSource: { file: "fixture/StableSender.java", line: 12, inScanScope: true },
          aggregateSource: {
            file: "fixture/MetadataContributor.java",
            line: 8,
            inScanScope: true,
          },
          destinationSource: {
            file: "fixture/DestinationResolver.java",
            line: 14,
            inScanScope: true,
          },
          typeSource: { file: "fixture/TypeCatalog.java", line: 8, inScanScope: true },
          versionSource: { file: "fixture/TypeCatalog.java", line: 15, inScanScope: true },
        },
      ],
      integrationEventConsumers: [
        {
          handler: "fixture.Routes#accepted()",
          destination: "fixture-events",
          eventType: "fixture.accepted",
          inboxBacked: true,
          inboxSource: { file: "fixture/Router.java", line: 20, inScanScope: true },
          source: { file: "fixture/Routes.java", line: 10, inScanScope: true },
        },
      ],
      projectionUpdates: [
        {
          handler: "fixture.AcceptedProjection#handle(fixture.AcceptedEvent)",
          eventType: "fixture.AcceptedEvent",
          projection: "fixtures",
          scope: "entity",
          handlerSource: { file: "fixture/AcceptedProjection.java", line: 10, inScanScope: true },
          mutationSource: { file: "fixture/AcceptedProjection.java", line: 11, inScanScope: true },
          syncSource: { file: "fixture/AcceptedProjection.java", line: 13, inScanScope: true },
        },
      ],
      externalCalls: [
        {
          handler: "fixture.AcceptedHandler",
          port: "fixture.Provider",
          adapter: "fixture.ProcessProvider",
          external: "local-process:java.lang.ProcessBuilder",
          handlerSource: { file: "fixture/AcceptedHandler.java", line: 8, inScanScope: true },
          factorySource: { file: "fixture/Dependencies.java", line: 10, inScanScope: true },
          adapterSource: { file: "fixture/ProcessProvider.java", line: 4, inScanScope: true },
          externalSource: { file: "fixture/ProcessProvider.java", line: 12, inScanScope: true },
        },
      ],
      diagnostics: [
        {
          kind: "WARNING",
          message: "fixture warning",
          source: { file: "fixture/AcceptedHandler.java", line: 8, inScanScope: true },
        },
      ],
    }));
    const javaResult = await scan(
      createJavaArchitectureScanner(loadJavaEvidence),
      "/workspace/backend",
    );

    expect(loadTypeScriptGraph).toHaveBeenCalledWith("/workspace/front");
    expect(typeScriptResult).toEqual({ graph: typeScriptGraph, diagnostics: [] });
    expect(loadJavaEvidence).toHaveBeenCalledWith("/workspace/backend");
    expect(javaResult.graph.findNode("java-domain-event:fixture.AcceptedEvent")).toBeDefined();
    expect(javaResult.graph.findNode("protocol:http:POST:/verify")).toBeDefined();
    expect(
      javaResult.graph.findNode("integration:fixture-events:fixture.accepted:v1"),
    ).toBeDefined();
    expect(javaResult.graph.findNode("fixtures")).toMatchObject({ kind: "State" });
    expect(javaResult.graph.findNode("local-process:java.lang.ProcessBuilder")).toMatchObject({
      kind: "External",
    });
    expect(javaResult.diagnostics).toEqual([
      {
        severity: "warning",
        message: "fixture warning",
        sourceLocation: { file: "fixture/AcceptedHandler.java", line: 8 },
      },
    ]);
  });
});
