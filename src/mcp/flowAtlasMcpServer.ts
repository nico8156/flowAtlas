import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildArchitectureContext } from "../application/architectureContext.js";
import { findArchitectureNodes } from "../application/architectureNodeDiscovery.js";
import type { ArchitectureScanner } from "../application/architectureScanner.js";
import type { NodeKind } from "../domain/architectureGraph.js";

const nodeKindSchema = z.enum(["Event", "Handler", "State", "External"]);
const directionSchema = z.enum(["upstream", "downstream", "both"]);
const adapterSchema = z.enum(["typescript", "java"]);

const toolResult = (value: object) => ({
  content: [
    {
      type: "text" as const,
      text: "FlowAtlas returned structured architectural data in structuredContent.",
    },
  ],
  structuredContent: value as Record<string, unknown>,
});

export const createFlowAtlasMcpServer = (scanner: ArchitectureScanner): McpServer => {
  const server = new McpServer({ name: "flowatlas", version: "0.1.0" });

  server.registerTool(
    "flowatlas_find_nodes",
    {
      description:
        "Find a small deterministic set of architectural nodes in an explicit project adapter.",
      inputSchema: {
        query: z.string().min(1).describe("Node id or source text to find"),
        projectPath: z.string().default(".").describe("Project root"),
        adapter: adapterSchema.default("typescript").describe("FlowAtlas analysis adapter"),
        requestPath: z.string().optional().describe("Required Java semantic request path"),
        kind: nodeKindSchema.describe("Canonical FlowAtlas node kind"),
        limit: z.number().int().positive().default(5),
      },
    },
    async ({ query, projectPath, adapter, requestPath, kind, limit }) => {
      const { graph } = await scanner.scan({
        projectPath,
        adapter,
        ...(requestPath ? { requestPath } : {}),
      });
      return toolResult(findArchitectureNodes(graph, query, [kind as NodeKind], limit));
    },
  );

  server.registerTool(
    "flowatlas_get_context",
    {
      description: "Build a bounded architectural context around one canonical node id.",
      inputSchema: {
        nodeId: z.string().min(1).describe("Exact canonical FlowAtlas node id"),
        projectPath: z.string().default(".").describe("Project root"),
        adapter: adapterSchema.default("typescript").describe("FlowAtlas analysis adapter"),
        requestPath: z.string().optional().describe("Required Java semantic request path"),
        direction: directionSchema.default("both"),
        maxDepth: z.number().int().nonnegative().default(3),
        maxNodes: z.number().int().positive().default(40),
        maxEdges: z.number().int().nonnegative().default(80),
        maxBytes: z.number().int().positive().default(16_384),
      },
    },
    async ({
      nodeId,
      projectPath,
      adapter,
      requestPath,
      direction,
      maxDepth,
      maxNodes,
      maxEdges,
      maxBytes,
    }) => {
      const { graph } = await scanner.scan({
        projectPath,
        adapter,
        ...(requestPath ? { requestPath } : {}),
      });
      return toolResult(
        buildArchitectureContext(graph, nodeId, direction, maxDepth, {
          maxNodes,
          maxEdges,
          maxBytes,
        }),
      );
    },
  );

  return server;
};
