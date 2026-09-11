import type { ArchitectureGraph, SourceLocation } from "../domain/architectureGraph.js";

export type ArchitectureScanRequest = {
  projectPath: string;
};

export type ArchitectureScanDiagnostic = {
  severity: "error" | "warning" | "info";
  message: string;
  sourceLocation?: SourceLocation;
};

export type ArchitectureScanResult = {
  graph: ArchitectureGraph;
  diagnostics: readonly ArchitectureScanDiagnostic[];
};

export type ArchitectureScanner = {
  scan(request: ArchitectureScanRequest): Promise<ArchitectureScanResult>;
};
