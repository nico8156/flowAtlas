import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { buildArchitectureContext } from "../../src/application/architectureContext.js";
import { findArchitectureNodes } from "../../src/application/architectureNodeDiscovery.js";
import { createFlowAtlasMcpServer } from "../../src/mcp/flowAtlasMcpServer.js";
import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");
const describeFragments = existsSync(resolve(fragmentsRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeFragments("FlowAtlas MCP agent context", () => {
  const closeables: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(closeables.splice(0).map((closeable) => closeable.close()));
  });

  it("discovers and projects a real architecture through the MCP protocol", async () => {
    const loadedProject = await loadTypeScriptProject(fragmentsRoot);
    const graph = scanTypeScriptProject(loadedProject.project);
    const server = createFlowAtlasMcpServer(async () => graph);
    const client = new Client({ name: "flowatlas-acceptance", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    closeables.push(client, server);

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name)).toEqual([
      "flowatlas_find_nodes",
      "flowatlas_get_context",
    ]);

    const discoveryResult = await client.callTool({
      name: "flowatlas_find_nodes",
      arguments: {
        query: "uiLikeToggleRequested",
        projectPath: fragmentsRoot,
        kind: "Event",
        limit: 5,
      },
    });
    expect(discoveryResult.isError).not.toBe(true);
    expect(discoveryResult.structuredContent).toEqual(
      findArchitectureNodes(graph, "uiLikeToggleRequested", ["Event"], 5),
    );
    expect(discoveryResult.structuredContent).toMatchObject({
      schemaVersion: 1,
      query: "uiLikeToggleRequested",
      request: { kinds: ["Event"], limit: 5 },
      matches: [
        expect.objectContaining({
          id: "uiLikeToggleRequested",
          kind: "Event",
          sourceLocation: expect.objectContaining({
            file: expect.stringContaining("likePressedUseCase.ts"),
          }),
        }),
      ],
    });

    const contextResult = await client.callTool({
      name: "flowatlas_get_context",
      arguments: {
        nodeId: "uiLikeToggleRequested",
        projectPath: fragmentsRoot,
        direction: "both",
        maxDepth: 1,
        maxNodes: 10,
        maxEdges: 10,
      },
    });
    expect(contextResult.isError).not.toBe(true);
    expect(contextResult.structuredContent).toEqual(
      buildArchitectureContext(graph, "uiLikeToggleRequested", "both", 1, {
        maxNodes: 10,
        maxEdges: 10,
      }),
    );
    expect(contextResult.structuredContent).toMatchObject({
      schemaVersion: 1,
      focus: { id: "uiLikeToggleRequested", kind: "Event" },
      request: {
        direction: "both",
        maxDepth: 1,
        maxNodes: 10,
        maxEdges: 10,
      },
      complete: true,
      returned: { nodes: 2, edges: 1 },
      frontier: [],
      projection: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "uiLikeToggleRequested", kind: "Event" }),
          expect.objectContaining({ id: "likeToggleUseCaseFactory", kind: "Handler" }),
        ]),
        edges: [
          {
            source: "likeToggleUseCaseFactory",
            target: "uiLikeToggleRequested",
            kind: "LISTENS_TO",
          },
        ],
      },
    });
  }, 300_000);
});
