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
});
