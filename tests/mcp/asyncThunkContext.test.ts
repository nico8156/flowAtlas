import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ArchitectureContext } from "../../src/application/architectureContext.js";
import { createFlowAtlasMcpServer } from "../../src/mcp/flowAtlasMcpServer.js";
import { createTypeScriptArchitectureScanner } from "../../src/scanner/typeScriptArchitectureScanner.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import type { TypeScriptProject } from "../../src/scanner/projectSymbolResolver.js";

const readProjectFiles = () =>
  Promise.all(
    ["typedAsyncThunkFactory.ts", "mcpThunkDispatch/state.ts", "mcpThunkDispatch/thunks.ts"].map(
      async (file) => ({
        file: `tests/fixtures/${file}`,
        source: await readFile(resolve(import.meta.dirname, "../fixtures", file), "utf8"),
      }),
    ),
  );

const getThunkContext = async (project: TypeScriptProject) => {
  const server = createFlowAtlasMcpServer(
    createTypeScriptArchitectureScanner(async () => scanTypeScriptProject(project)),
  );
  const client = new Client({ name: "flowatlas-thunk-context", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await client.callTool({
      name: "flowatlas_get_context",
      arguments: {
        nodeId: "loadItems",
        direction: "both",
        maxDepth: 2,
        maxNodes: 20,
        maxEdges: 30,
        maxBytes: 8192,
      },
    });
  } finally {
    await Promise.all([client.close(), server.close()]);
  }
};

describe("MCP async thunk context", () => {
  it("exposes an aliased slice action dispatched by a typed thunk and its State", async () => {
    const files = await readProjectFiles();
    const result = await getThunkContext({ files });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      complete: true,
      coverage: { graph: "bounded-projection", application: "not-assessed" },
      projection: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "itemSelected", kind: "Event" }),
          expect.objectContaining({ id: "itemsSlice", kind: "State" }),
        ]),
        edges: expect.arrayContaining([
          { source: "loadItems", target: "itemSelected", kind: "DISPATCHES" },
          { source: "itemSelected", target: "itemsSlice", kind: "UPDATES" },
        ]),
      },
    });
    const { projection } = result.structuredContent as ArchitectureContext;
    expect(projection.nodes.some((node) => node.id === "unresolvedAction")).toBe(false);
    expect(projection.edges).not.toContainEqual({
      source: "loadItems",
      target: "itemRemoved",
      kind: "DISPATCHES",
    });
    expect(projection.edges).not.toContainEqual({
      source: "loadItems.fulfilled",
      target: "itemsSlice",
      kind: "UPDATES",
    });
  });

  it("omits dispatched actions whose declarations are outside the architectural scan scope", async () => {
    const projectFiles = await readProjectFiles();
    const files = projectFiles.filter((file) => !file.file.endsWith("/state.ts"));
    const result = await getThunkContext({ files, projectFiles });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      projection: {
        edges: expect.arrayContaining([
          { source: "loadItems", target: "loadItems.fulfilled", kind: "DISPATCHES" },
        ]),
      },
    });
    const { projection } = result.structuredContent as ArchitectureContext;
    expect(projection.nodes.some((node) => node.id === "itemsSlice")).toBe(false);
    expect(projection.nodes.some((node) => node.id === "itemSelected")).toBe(false);
  });
});
