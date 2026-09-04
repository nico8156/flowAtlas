import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createFlowAtlasMcpServer } from "../../src/mcp/flowAtlasMcpServer.js";

describe("FlowAtlas MCP server", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(closeables.splice(0).map((closeable) => closeable.close()));
  });

  it("returns structured context with only a compact textual acknowledgement", async () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    const server = createFlowAtlasMcpServer(async () => graph);
    const client = new Client({ name: "flowatlas-unit", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "flowatlas_get_context",
      arguments: {
        nodeId: "requested",
        projectPath: ".",
        direction: "both",
        maxDepth: 1,
        maxNodes: 10,
        maxEdges: 10,
        maxBytes: 900,
      },
    });

    expect(result.content).toEqual([
      {
        type: "text",
        text: "FlowAtlas returned structured architectural data in structuredContent.",
      },
    ]);
    expect(result.structuredContent).toMatchObject({
      schemaVersion: 2,
      focus: { id: "requested", kind: "Event" },
      request: { maxBytes: 900 },
    });
  });
});
