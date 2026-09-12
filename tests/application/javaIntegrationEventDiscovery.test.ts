import { describe, expect, it, vi } from "vitest";

import { findArchitectureNodes } from "../../src/application/architectureNodeDiscovery.js";
import { createJavaArchitectureScanner } from "../../src/scanner/javaArchitectureScanner.js";

describe("Java integration-event discovery", () => {
  it("finds a canonical integration event from its statically mapped Java event type", async () => {
    const scanner = createJavaArchitectureScanner(
      vi.fn(async () => ({
        types: [],
        handler: {
          qualifiedName: "fixture.HiddenHandler",
          eventType: "fixture.HiddenEvent",
          source: { file: "Hidden.java", line: 1, inScanScope: false },
        },
        domainEventPublications: [],
        command: null,
        commandHandler: null,
        httpEndpoint: null,
        commandDispatches: [],
        integrationEventMappings: [
          {
            producerEvent: "fixture.events.TicketVerifyAcceptedEvent",
            aggregateType: "Ticket",
            destination: "ticket-events",
            eventType: "ticket.verify.accepted",
            version: 1,
            sender: "fixture.integration.StableSender#send()",
            senderSource: { file: "StableSender.java", line: 10, inScanScope: true },
            aggregateSource: { file: "Metadata.java", line: 10, inScanScope: true },
            destinationSource: { file: "Destination.java", line: 10, inScanScope: true },
            typeSource: { file: "Type.java", line: 10, inScanScope: true },
            versionSource: { file: "Version.java", line: 10, inScanScope: true },
          },
        ],
        integrationEventConsumers: [],
        projectionUpdates: [],
        externalCalls: [],
        scheduledHandlers: [],
        diagnostics: [],
      })),
    );

    const result = await scanner.scan({ projectPath: "/workspace/backend", adapter: "java" });
    const discovery = findArchitectureNodes(
      result.graph,
      "TicketVerifyAcceptedEvent",
      ["Event"],
      5,
      result.discoveryAliases,
    );

    expect(discovery.matches).toEqual([
      expect.objectContaining({ id: "integration:ticket-events:ticket.verify.accepted:v1" }),
    ]);
  });
});
