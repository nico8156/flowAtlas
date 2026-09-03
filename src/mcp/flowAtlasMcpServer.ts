import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { buildArchitectureContext } from "../application/architectureContext.js";
import { findArchitectureNodes } from "../application/architectureNodeDiscovery.js";
import type { ArchitectureGraph, NodeKind } from "../domain/architectureGraph.js";

export type ArchitectureGraphLoader = (projectPath: string) => Promise<ArchitectureGraph>;

const nodeKindSchema = z.enum(["Event", "Handler", "State", "External"]);
const directionSchema = z.enum(["upstream", "downstream", "both"]);

const toolResult = (value: object) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  structuredContent: value as Record<string, unknown>,
});

export const createFlowAtlasMcpServer = (loadGraph: ArchitectureGraphLoader): McpServer => {
  const server = new McpServer({ name: "flowatlas", version: "0.1.0" });

  server.registerTool(
    "flowatlas_find_nodes",
    {
      description: "Find a small deterministic set of architectural nodes in a TypeScript project.",
      inputSchema: {
        query: z.string().min(1).describe("Node id or source text to find"),
        projectPath: z.string().default(".").describe("TypeScript project root"),
        kind: nodeKindSchema.describe("Canonical FlowAtlas node kind"),
        limit: z.number().int().positive().default(5),
      },
    },
    async ({ query, projectPath, kind, limit }) => {
      const graph = await loadGraph(projectPath);
      return toolResult(findArchitectureNodes(graph, query, [kind as NodeKind], limit));
    },
  );

  server.registerTool(
    "flowatlas_get_context",
    {
      description: "Build a bounded architectural context around one canonical node id.",
      inputSchema: {
        nodeId: z.string().min(1).describe("Exact canonical FlowAtlas node id"),
        projectPath: z.string().default(".").describe("TypeScript project root"),
        direction: directionSchema.default("both"),
        maxDepth: z.number().int().nonnegative().default(3),
        maxNodes: z.number().int().positive().default(40),
        maxEdges: z.number().int().nonnegative().default(80),
      },
    },
    async ({ nodeId, projectPath, direction, maxDepth, maxNodes, maxEdges }) => {
      const graph = await loadGraph(projectPath);
      return toolResult(
        buildArchitectureContext(graph, nodeId, direction, maxDepth, { maxNodes, maxEdges }),
      );
    },
  );

  return server;
};
