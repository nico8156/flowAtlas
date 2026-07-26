import { describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";

describe("ArchitectureGraph", () => {
  it("can be created empty", () => {
    const graph = createArchitectureGraph();

    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("can contain one architectural node", () => {
    const graph = createArchitectureGraph();
    const node = { id: "node-1", kind: "Event" as const };

    graph.addNode(node);

    expect(graph.nodes).toContain(node);
  });

  it("can contain multiple independent nodes", () => {
    const graph = createArchitectureGraph();
    const firstNode = { id: "node-1", kind: "Event" as const };
    const secondNode = { id: "node-2", kind: "Event" as const };

    graph.addNode(firstNode);
    graph.addNode(secondNode);

    expect(graph.nodes).toContain(firstNode);
    expect(graph.nodes).toContain(secondNode);
  });

  it("can contain a directed relation between two existing nodes", () => {
    const graph = createArchitectureGraph();
    const sourceNode = { id: "node-a", kind: "Handler" as const };
    const targetNode = { id: "node-b", kind: "Event" as const };

    graph.addNode(sourceNode);
    graph.addNode(targetNode);
    graph.addEdge({
      source: sourceNode.id,
      target: targetNode.id,
      kind: "LISTENS_TO",
    });

    expect(graph.edges).toContainEqual({
      source: sourceNode.id,
      target: targetNode.id,
      kind: "LISTENS_TO",
    });
    expect(graph.edges).not.toContainEqual({
      source: targetNode.id,
      target: sourceNode.id,
      kind: "LISTENS_TO",
    });
  });

  it("can identify the architectural kind of a relation", () => {
    const graph = createArchitectureGraph();
    const sourceNode = { id: "node-a", kind: "Handler" as const };
    const targetNode = { id: "node-b", kind: "Event" as const };
    const edge = {
      source: sourceNode.id,
      target: targetNode.id,
      kind: "LISTENS_TO" as const,
    };

    graph.addNode(sourceNode);
    graph.addNode(targetNode);
    graph.addEdge(edge);

    expect(graph.edges).toContainEqual(edge);
  });

  it("can identify an architectural node as an Event", () => {
    const graph = createArchitectureGraph();
    const eventNode = { id: "event-1", kind: "Event" as const };

    graph.addNode(eventNode);

    expect(graph.nodes).toContainEqual(eventNode);
  });

  it("rejects LISTENS_TO when the source is not a Handler", () => {
    const graph = createArchitectureGraph();
    const eventNode = { id: "event-1", kind: "Event" as const };
    const handlerNode = { id: "handler-1", kind: "Handler" as const };

    graph.addNode(eventNode);
    graph.addNode(handlerNode);

    expect(() =>
      graph.addEdge({
        source: eventNode.id,
        target: handlerNode.id,
        kind: "LISTENS_TO",
      }),
    ).toThrow();
  });

  it("rejects DISPATCHES when the source is not a Handler", () => {
    const graph = createArchitectureGraph();
    const eventNode = { id: "event-1", kind: "Event" as const };
    const handlerNode = { id: "handler-1", kind: "Handler" as const };

    graph.addNode(eventNode);
    graph.addNode(handlerNode);

    expect(() =>
      graph.addEdge({
        source: eventNode.id,
        target: handlerNode.id,
        kind: "DISPATCHES",
      }),
    ).toThrow();
  });

  it("rejects UPDATES when the source is not an Event", () => {
    const graph = createArchitectureGraph();
    const handlerNode = { id: "handler-1", kind: "Handler" as const };
    const stateNode = { id: "state-1", kind: "State" as const };

    graph.addNode(handlerNode);
    graph.addNode(stateNode);

    expect(() =>
      graph.addEdge({
        source: handlerNode.id,
        target: stateNode.id,
        kind: "UPDATES",
      }),
    ).toThrow();
  });

  it("rejects CALLS_EXTERNAL when the source is not a Handler", () => {
    const graph = createArchitectureGraph();
    const eventNode = { id: "event-1", kind: "Event" as const };
    const externalNode = { id: "external-1", kind: "External" as const };

    graph.addNode(eventNode);
    graph.addNode(externalNode);

    expect(() =>
      graph.addEdge({
        source: eventNode.id,
        target: externalNode.id,
        kind: "CALLS_EXTERNAL",
      }),
    ).toThrow();
  });

  it("rejects an edge whose source is not in the graph", () => {
    const graph = createArchitectureGraph();
    const missingSourceId = "missing-handler";
    const eventNode = { id: "event-1", kind: "Event" as const };

    graph.addNode(eventNode);

    expect(() =>
      graph.addEdge({
        source: missingSourceId,
        target: eventNode.id,
        kind: "LISTENS_TO",
      }),
    ).toThrow();
  });
});
