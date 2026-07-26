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
    const node = { id: "node-1" };

    graph.addNode(node);

    expect(graph.nodes).toContain(node);
  });

  it("can contain multiple independent nodes", () => {
    const graph = createArchitectureGraph();
    const firstNode = { id: "node-1" };
    const secondNode = { id: "node-2" };

    graph.addNode(firstNode);
    graph.addNode(secondNode);

    expect(graph.nodes).toContain(firstNode);
    expect(graph.nodes).toContain(secondNode);
  });

  it("can contain a directed relation between two existing nodes", () => {
    const graph = createArchitectureGraph();
    const sourceNode = { id: "node-a" };
    const targetNode = { id: "node-b" };

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
    const sourceNode = { id: "node-a" };
    const targetNode = { id: "node-b" };
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
});
