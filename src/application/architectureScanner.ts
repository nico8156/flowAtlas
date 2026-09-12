import type { ArchitectureGraph, SourceLocation } from "../domain/architectureGraph.js";

export type ArchitectureScanRequest = {
  projectPath: string;
  adapter?: "typescript" | "java";
  requestPath?: string;
};

export type ArchitectureScanDiagnostic = {
  severity: "error" | "warning" | "info";
  message: string;
  sourceLocation?: SourceLocation;
};

/**
 * Non-canonical names that were statically proven for discovery only.
 * They never become ArchitectureGraph nodes or relations.
 */
export type ArchitectureNodeDiscoveryAlias = {
  nodeId: string;
  aliases: readonly string[];
};

export type ArchitectureScanResult = {
  graph: ArchitectureGraph;
  diagnostics: readonly ArchitectureScanDiagnostic[];
  discoveryAliases?: readonly ArchitectureNodeDiscoveryAlias[];
};

export type ArchitectureScanner = {
  scan(request: ArchitectureScanRequest): Promise<ArchitectureScanResult>;
};
