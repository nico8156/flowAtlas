import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { projectDownstream, projectUpstream } from "../../src/domain/graphProjection.js";

describe("Graph projection", () => {
  it("projects the downstream territory from a focused Event", () => {
    const graph = createArchitectureGraph();
    const nodes = [
      { id: "uiTicketSubmitRequested", kind: "Event" as const },
      { id: "ticketSubmitUseCaseFactory", kind: "Handler" as const },
      { id: "ticketOptimisticCreated", kind: "Event" as const },
      { id: "tState", kind: "State" as const },
      { id: "unrelatedEvent", kind: "Event" as const },
    ];
    const edges = [
      {
        source: "ticketSubmitUseCaseFactory",
        target: "uiTicketSubmitRequested",
        kind: "LISTENS_TO" as const,
      },
      {
        source: "ticketSubmitUseCaseFactory",
        target: "ticketOptimisticCreated",
        kind: "DISPATCHES" as const,
      },
      {
        source: "ticketOptimisticCreated",
        target: "tState",
        kind: "UPDATES" as const,
      },
    ];
    nodes.forEach((node) => graph.addNode(node));
    edges.forEach((edge) => graph.addEdge(edge));

    const projection = projectDownstream(graph, "uiTicketSubmitRequested");

    expect(projection.nodes.map((node) => node.id)).toEqual([
      "uiTicketSubmitRequested",
      "ticketSubmitUseCaseFactory",
      "ticketOptimisticCreated",
      "tState",
    ]);
    expect(projection.edges).toEqual(edges);
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toEqual(edges);
  });

  it("projects the upstream territory from a focused State", () => {
    const graph = createArchitectureGraph();
    const nodes = [
      { id: "uiTicketSubmitRequested", kind: "Event" as const },
      { id: "ticketSubmitUseCaseFactory", kind: "Handler" as const },
      { id: "ticketOptimisticCreated", kind: "Event" as const },
      { id: "tState", kind: "State" as const },
    ];
    const edges = [
      {
        source: "ticketSubmitUseCaseFactory",
        target: "uiTicketSubmitRequested",
        kind: "LISTENS_TO" as const,
      },
      {
        source: "ticketSubmitUseCaseFactory",
        target: "ticketOptimisticCreated",
        kind: "DISPATCHES" as const,
      },
      {
        source: "ticketOptimisticCreated",
        target: "tState",
        kind: "UPDATES" as const,
      },
    ];
    nodes.forEach((node) => graph.addNode(node));
    edges.forEach((edge) => graph.addEdge(edge));

    const projection = projectUpstream(graph, "tState");

    expect(projection.nodes.map((node) => node.id)).toEqual([
      "uiTicketSubmitRequested",
      "ticketSubmitUseCaseFactory",
      "ticketOptimisticCreated",
      "tState",
    ]);
    expect(projection.edges).toEqual(edges);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toEqual(edges);
  });
});
