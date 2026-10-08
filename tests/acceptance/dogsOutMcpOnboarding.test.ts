import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { ArchitectureContext } from "../../src/application/architectureContext.js";
import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import { createFlowAtlasMcpServer } from "../../src/mcp/flowAtlasMcpServer.js";
import { createTypeScriptArchitectureScanner } from "../../src/scanner/typeScriptArchitectureScanner.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const dogsOutRoot = resolve(process.env.FLOWATLAS_DOGS_OUT_MOBILE_ROOT ?? "../dogsout/mobile");
const describeDogsOut = existsSync(resolve(dogsOutRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeDogsOut("Dogs Out MCP onboarding", () => {
  it("exposes the thunk's explicit dispatches into dog and authentication State", async () => {
    const server = createFlowAtlasMcpServer(
      createTypeScriptArchitectureScanner(async (projectPath) => {
        const { project } = await loadTypeScriptProject(projectPath);
        return scanTypeScriptProject(project);
      }),
    );
    const client = new Client({ name: "flowatlas-dogsout-onboarding", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.callTool({
        name: "flowatlas_get_context",
        arguments: {
          projectPath: dogsOutRoot,
          nodeId: "loadOnboarding",
          direction: "both",
          maxDepth: 3,
          maxNodes: 40,
          maxEdges: 80,
          maxBytes: 16384,
        },
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        coverage: { graph: "bounded-projection", application: "not-assessed" },
        projection: {
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "dogSlice", kind: "State" }),
            expect.objectContaining({ id: "authenticationSlice", kind: "State" }),
          ]),
          edges: expect.arrayContaining([
            { source: "loadOnboarding", target: "dogsLoaded", kind: "DISPATCHES" },
            { source: "loadOnboarding", target: "onboardingCompleted", kind: "DISPATCHES" },
            { source: "loadOnboarding", target: "becameAnonymous", kind: "DISPATCHES" },
            { source: "dogsLoaded", target: "dogSlice", kind: "UPDATES" },
            { source: "onboardingCompleted", target: "authenticationSlice", kind: "UPDATES" },
            { source: "loadOnboarding", target: "OnboardingGateway", kind: "CALLS_EXTERNAL" },
            { source: "loadOnboarding", target: "SessionVault", kind: "CALLS_EXTERNAL" },
          ]),
        },
      });
      const { projection } = result.structuredContent as ArchitectureContext;
      expect(projection.edges).not.toContainEqual({
        source: "loadOnboarding.fulfilled",
        target: "dogSlice",
        kind: "UPDATES",
      });
      expect(projection.edges).not.toContainEqual({
        source: "loadOnboarding",
        target: "dogSelected",
        kind: "DISPATCHES",
      });
    } finally {
      await Promise.all([client.close(), server.close()]);
    }
  }, 120_000);
});
