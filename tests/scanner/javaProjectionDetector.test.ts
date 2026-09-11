import { describe, expect, it } from "vitest";

import { detectJavaProjectionGraph } from "../../src/scanner/javaProjectionDetector.js";

const inScope = (file: string, line: number) => ({ file, line, inScanScope: true });

describe("Java projection detector", () => {
  it("projects an event-fed application projection and its direct sync signal", () => {
    const graph = detectJavaProjectionGraph({
      projectionUpdates: [
        {
          handler: "fixture.read.TicketAcceptedProjection#handle(fixture.events.TicketAccepted)",
          eventType: "fixture.events.TicketAccepted",
          projection: "tickets",
          scope: "entity",
          handlerSource: inScope("fixture/read/TicketAcceptedProjection.java", 18),
          mutationSource: inScope("fixture/read/TicketAcceptedProjection.java", 19),
          syncSource: inScope("fixture/read/TicketAcceptedProjection.java", 22),
        },
      ],
    });

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "java-domain-event:fixture.events.TicketAccepted",
          kind: "Event",
        }),
        expect.objectContaining({
          id: "sync:tickets:entity",
          kind: "Event",
        }),
        expect.objectContaining({ id: "tickets", kind: "State" }),
        expect.objectContaining({
          id: "fixture.read.TicketAcceptedProjection#handle(fixture.events.TicketAccepted)",
          kind: "Handler",
        }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "java-domain-event:fixture.events.TicketAccepted",
          target: "tickets",
          kind: "UPDATES",
        }),
        expect.objectContaining({
          source: "fixture.read.TicketAcceptedProjection#handle(fixture.events.TicketAccepted)",
          target: "sync:tickets:entity",
          kind: "DISPATCHES",
        }),
        expect.objectContaining({
          source: "sync:tickets:entity",
          target: "tickets",
          kind: "UPDATES",
        }),
      ]),
    );
  });

  it("omits a projection when its mutation or direct sync proof is out of scan scope", () => {
    const graph = detectJavaProjectionGraph({
      projectionUpdates: [
        {
          handler: "fixture.read.HiddenProjection#handle(fixture.events.Hidden)",
          eventType: "fixture.events.Hidden",
          projection: "hidden",
          scope: "entity",
          handlerSource: inScope("fixture/read/HiddenProjection.java", 10),
          mutationSource: {
            file: "fixture/read/HiddenProjectionRepository.java",
            line: 12,
            inScanScope: false,
          },
          syncSource: inScope("fixture/read/HiddenProjection.java", 15),
        },
      ],
    });

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
