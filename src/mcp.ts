#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { loadTypeScriptProject } from "./cli/projectLoader.js";
import {
  createMetadataVerifiedProjectLoader,
  inspectTypeScriptProjectManifest,
  updateTypeScriptProjectFromManifest,
} from "./cli/metadataVerifiedProjectLoader.js";
import { createFlowAtlasMcpServer } from "./mcp/flowAtlasMcpServer.js";
import { createProgramReusingProjectScanner } from "./mcp/programReusingProjectScanner.js";
import { createVerifiedSnapshotGraphLoader } from "./mcp/verifiedSnapshotGraphLoader.js";
import { createTypeScriptArchitectureScanner } from "./scanner/typeScriptArchitectureScanner.js";
import { createJavaMavenArchitectureScanner } from "./scanner/javaMavenArchitectureScanner.js";

const projectLoader =
  process.env.FLOWATLAS_SNAPSHOT_VERIFICATION === "metadata"
    ? createMetadataVerifiedProjectLoader({
        inspectManifest: inspectTypeScriptProjectManifest,
        loadProject: loadTypeScriptProject,
        updateProject: updateTypeScriptProjectFromManifest,
      })
    : loadTypeScriptProject;

const typeScriptScanner = createTypeScriptArchitectureScanner(
  createVerifiedSnapshotGraphLoader(
    projectLoader,
    createProgramReusingProjectScanner({ maxPrograms: 4 }),
    { maxSnapshots: 4 },
  ),
);
const javaScanner = createJavaMavenArchitectureScanner();
const server = createFlowAtlasMcpServer({
  scan: (request) =>
    request.adapter === "java" ? javaScanner.scan(request) : typeScriptScanner.scan(request),
});

server.connect(new StdioServerTransport()).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`FlowAtlas MCP: ${message}\n`);
  process.exitCode = 1;
});
