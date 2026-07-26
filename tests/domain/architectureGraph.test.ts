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
});
