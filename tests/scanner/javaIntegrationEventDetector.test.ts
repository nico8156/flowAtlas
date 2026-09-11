import { describe, expect, it } from "vitest";

import { detectJavaIntegrationEventGraph } from "../../src/scanner/javaIntegrationEventDetector.js";

const inScope = (file: string, line: number) => ({ file, line, inScanScope: true });

describe("Java integration-event detector", () => {
  it("projects only destination-matched in-scope publication and consumer evidence", () => {
    const graph = detectJavaIntegrationEventGraph({
      integrationEventMappings: [
        {
          producerEvent: "fixture.events.TicketVerifyAcceptedEvent",
          aggregateType: "Ticket",
          destination: "ticket-events",
          eventType: "ticket.verify.accepted",
          version: 1,
          sender: "fixture.integration.StableSender#send(fixture.integration.OutboxEvent)",
          senderSource: inScope("fixture/integration/StableSender.java", 20),
          aggregateSource: inScope("fixture/integration/MetadataContributor.java", 8),
          destinationSource: inScope("fixture/integration/DestinationResolver.java", 14),
          typeSource: inScope("fixture/integration/TypeCatalog.java", 8),
          versionSource: inScope("fixture/integration/TypeCatalog.java", 15),
        },
        {
          producerEvent: "fixture.events.TicketVerifyAcceptedEvent",
          aggregateType: "Ticket",
          destination: "hidden-events",
          eventType: "ticket.verify.accepted",
          version: 1,
          sender: "fixture.integration.StableSender#send(fixture.integration.OutboxEvent)",
          senderSource: inScope("fixture/integration/StableSender.java", 20),
          aggregateSource: inScope("fixture/integration/MetadataContributor.java", 8),
          destinationSource: inScope("fixture/integration/DestinationResolver.java", 15),
          typeSource: {
            file: "fixture/integration/HiddenTypeCatalog.java",
            line: 8,
            inScanScope: false,
          },
          versionSource: inScope("fixture/integration/TypeCatalog.java", 15),
        },
      ],
      integrationEventConsumers: [
        {
          handler: "fixture.integration.TicketRoutes#accepted()",
          destination: "ticket-events",
          eventType: "ticket.verify.accepted",
          inboxBacked: true,
          inboxSource: inScope("fixture/integration/Router.java", 20),
          source: inScope("fixture/integration/TicketRoutes.java", 12),
        },
        {
          handler: "fixture.integration.TicketRoutes#other()",
          destination: "ticket-events",
          eventType: "ticket.verification.completed",
          inboxBacked: true,
          inboxSource: inScope("fixture/integration/Router.java", 20),
          source: inScope("fixture/integration/TicketRoutes.java", 18),
        },
        {
          handler: "fixture.integration.TicketRoutes#hidden()",
          destination: "hidden-events",
          eventType: "ticket.verify.accepted",
          inboxBacked: true,
          inboxSource: inScope("fixture/integration/Router.java", 20),
          source: inScope("fixture/integration/TicketRoutes.java", 24),
        },
      ],
    });

    const integrationEvent = "integration:ticket-events:ticket.verify.accepted:v1";
    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: integrationEvent, kind: "Event" }),
      expect.objectContaining({
        id: "fixture.integration.StableSender#send(fixture.integration.OutboxEvent)",
        kind: "Handler",
      }),
      expect.objectContaining({
        id: "fixture.integration.TicketRoutes#accepted()",
        kind: "Handler",
      }),
    ]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "fixture.integration.StableSender#send(fixture.integration.OutboxEvent)",
        target: integrationEvent,
        kind: "DISPATCHES",
      }),
      expect.objectContaining({
        source: "fixture.integration.TicketRoutes#accepted()",
        target: integrationEvent,
        kind: "LISTENS_TO",
      }),
    ]);
    expect(graph.findNode("fixture.integration.TicketRoutes#other()")).toBeUndefined();
    expect(graph.findNode("fixture.integration.TicketRoutes#hidden()")).toBeUndefined();
    expect(graph.nodes.some((node) => node.id.startsWith("java-domain-event:"))).toBe(false);
  });
});
