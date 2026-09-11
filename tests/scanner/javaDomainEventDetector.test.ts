import { describe, expect, it } from "vitest";

import { detectJavaDomainEventGraph } from "../../src/scanner/javaDomainEventDetector.js";

const acceptedType = "fixture.events.TicketVerifyAcceptedEvent";
const completedType = "fixture.events.TicketVerificationCompletedEvent";
const handler = "fixture.application.TicketVerificationProcessManager";

describe("Java domain-event detector", () => {
  it("projects only typed listening and in-scope resolved publication evidence", () => {
    const graph = detectJavaDomainEventGraph({
      types: [
        {
          qualifiedName: acceptedType,
          assignableToDomainEvent: true,
          source: {
            file: "fixture/events/TicketVerifyAcceptedEvent.java",
            line: 5,
            inScanScope: false,
          },
        },
        {
          qualifiedName: completedType,
          assignableToDomainEvent: true,
          source: {
            file: "fixture/events/TicketVerificationCompletedEvent.java",
            line: 5,
            inScanScope: false,
          },
        },
        {
          qualifiedName: "fixture.events.ConventionOnlyEvent",
          assignableToDomainEvent: false,
          source: { file: "fixture/events/ConventionOnlyEvent.java", line: 3, inScanScope: false },
        },
      ],
      handler: {
        qualifiedName: handler,
        eventType: acceptedType,
        source: {
          file: "fixture/application/TicketVerificationProcessManager.java",
          line: 8,
          inScanScope: true,
        },
      },
      domainEventPublications: [
        {
          owner: "fixture.shared.DomainEventPublisher",
          method: "publish(fixture.shared.DomainEvent)",
          caller: `${handler}#handle(${acceptedType})`,
          argumentType: completedType,
          source: {
            file: "fixture/application/TicketVerificationProcessManager.java",
            line: 24,
            inScanScope: true,
          },
        },
        {
          owner: "fixture.shared.DomainEventPublisher",
          method: "publish(fixture.shared.DomainEvent)",
          caller: `${handler}#helper()`,
          argumentType: acceptedType,
          source: { file: "fixture/application/Helper.java", line: 4, inScanScope: false },
        },
      ],
    });

    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: `java-domain-event:${acceptedType}`, kind: "Event" }),
      expect.objectContaining({ id: handler, kind: "Handler" }),
      expect.objectContaining({ id: `java-domain-event:${completedType}`, kind: "Event" }),
    ]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: handler,
        target: `java-domain-event:${acceptedType}`,
        kind: "LISTENS_TO",
      }),
      expect.objectContaining({
        source: handler,
        target: `java-domain-event:${completedType}`,
        kind: "DISPATCHES",
      }),
    ]);
    expect(graph.findNode("java-domain-event:fixture.events.ConventionOnlyEvent")).toBeUndefined();
    expect(graph.nodes.some((node) => node.kind === "External")).toBe(false);
  });
});
