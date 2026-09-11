import type {
  ArchitectureScanDiagnostic,
  ArchitectureScanner,
} from "../application/architectureScanner.js";
import {
  detectJavaDomainEventGraph,
  type JavaDomainEventEvidence,
} from "./javaDomainEventDetector.js";

type JavaDiagnostic = {
  kind: string;
  message: string;
  source?: {
    file: string;
    line: number;
    inScanScope: boolean;
  };
};

type JavaSemanticEvidence = JavaDomainEventEvidence & {
  diagnostics: readonly JavaDiagnostic[];
};

type JavaSemanticEvidenceLoader = (projectPath: string) => Promise<JavaSemanticEvidence>;

const diagnosticSeverity = (kind: string): ArchitectureScanDiagnostic["severity"] => {
  if (kind === "ERROR") return "error";
  if (kind === "WARNING" || kind === "MANDATORY_WARNING") return "warning";
  return "info";
};

export const createJavaArchitectureScanner = (
  loadEvidence: JavaSemanticEvidenceLoader,
): ArchitectureScanner => ({
  async scan({ projectPath }) {
    const evidence = await loadEvidence(projectPath);
    return {
      graph: detectJavaDomainEventGraph(evidence),
      diagnostics: evidence.diagnostics.map(({ kind, message, source }) => ({
        severity: diagnosticSeverity(kind),
        message,
        ...(source ? { sourceLocation: { file: source.file, line: source.line } } : {}),
      })),
    };
  },
});
