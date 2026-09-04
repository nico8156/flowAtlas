#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadTypeScriptProject } from "./cli/projectLoader.js";
import {
  createMetadataVerifiedProjectLoader,
  inspectTypeScriptProjectManifest,
  updateTypeScriptProjectFromManifest,
} from "./cli/metadataVerifiedProjectLoader.js";
import { createFlowAtlasMcpServer } from "./mcp/flowAtlasMcpServer.js";
import { createVerifiedSnapshotGraphLoader } from "./mcp/verifiedSnapshotGraphLoader.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const projectLoader =
  process.env.FLOWATLAS_SNAPSHOT_VERIFICATION === "metadata"
    ? createMetadataVerifiedProjectLoader({
        inspectManifest: inspectTypeScriptProjectManifest,
        loadProject: loadTypeScriptProject,
        updateProject: updateTypeScriptProjectFromManifest,
      })
    : loadTypeScriptProject;

const server = createFlowAtlasMcpServer(
  createVerifiedSnapshotGraphLoader(projectLoader, scanTypeScriptProject),
);

server.connect(new StdioServerTransport()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`FlowAtlas MCP: ${message}\n`);
  process.exitCode = 1;
});
