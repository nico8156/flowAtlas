import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createFlowAtlasMcpServer } from "../../src/mcp/flowAtlasMcpServer.js";
import { formatJavaSemanticFailure } from "../../src/scanner/javaMavenArchitectureScanner.js";

describe("FlowAtlas MCP server", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(closeables.splice(0).map((closeable) => closeable.close()));
  });

  it("returns structured context with only a compact textual acknowledgement", async () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    const server = createFlowAtlasMcpServer({
      scan: async () => ({ graph, diagnostics: [] }),
    });
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

  it("forwards explicit Java adapter and request selection without changing the default", async () => {
    const graph = createArchitectureGraph();
    graph.addNode({ id: "java-node", kind: "Event" });
    const scan = vi.fn(async () => ({ graph, diagnostics: [] }));
    const server = createFlowAtlasMcpServer({ scan });
    const client = new Client({ name: "flowatlas-unit", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await client.callTool({
      name: "flowatlas_find_nodes",
      arguments: {
        query: "java-node",
        projectPath: "/workspace/fragments",
        adapter: "java",
        requestPath: "/workspace/flowatlas-ticket-request.json",
        kind: "Event",
        limit: 1,
      },
    });

    expect(scan).toHaveBeenCalledWith({
      projectPath: "/workspace/fragments",
      adapter: "java",
      requestPath: "/workspace/flowatlas-ticket-request.json",
    });
  });

  it("returns the concise Java scanner diagnostic through the MCP tool response", async () => {
    const diagnostic = formatJavaSemanticFailure("/workspace/request.json", {
      stderr:
        'Error: Java Maven semantic context: Java semantic analysis failed: Exception in thread "main" java.lang.IllegalStateException: Could not prove exactly one configured projection mutation',
    }).message;
    const server = createFlowAtlasMcpServer({
      scan: async () => {
        throw new Error(diagnostic);
      },
    });
    const client = new Client({ name: "flowatlas-java-error", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result = await client.callTool({
      name: "flowatlas_find_nodes",
      arguments: {
        query: "DailyWalkGoalConfiguredProjectionHandler",
        projectPath: "/workspace/dogsout",
        adapter: "java",
        requestPath: "/workspace/daily-walk-progress.json",
        kind: "Handler",
      },
    });

    expect(result.isError).toBe(true);
    const responseContent = (result as { content: Array<{ type: string; text?: string }> }).content;
    const responseText = responseContent
      .filter((content) => content.type === "text")
      .map((content) => content.text ?? "")
      .join("\n");
    expect(responseText).toContain(diagnostic);
    expect(responseText).not.toContain("--classpath");
  });
});
