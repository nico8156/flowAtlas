import type {
  ArchitectureScanDiagnostic,
  ArchitectureScanner,
} from "../application/architectureScanner.js";
import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import {
  detectJavaDomainEventGraph,
  type JavaDomainEventEvidence,
} from "./javaDomainEventDetector.js";
import {
  detectJavaHttpCommandGraph,
  type JavaHttpCommandEvidence,
} from "./javaHttpCommandDetector.js";
import {
  detectJavaIntegrationEventGraph,
  type JavaIntegrationEventEvidence,
} from "./javaIntegrationEventDetector.js";
import {
  detectJavaProjectionGraph,
  type JavaProjectionEvidence,
} from "./javaProjectionDetector.js";

type JavaDiagnostic = {
  kind: string;
  message: string;
  source?: {
    file: string;
    line: number;
    inScanScope: boolean;
  };
};

type JavaSemanticEvidence = JavaDomainEventEvidence &
  JavaHttpCommandEvidence &
  JavaIntegrationEventEvidence & {
    diagnostics: readonly JavaDiagnostic[];
  } & JavaProjectionEvidence;

type JavaSemanticEvidenceLoader = (projectPath: string) => Promise<JavaSemanticEvidence>;

const diagnosticSeverity = (kind: string): ArchitectureScanDiagnostic["severity"] => {
  if (kind === "ERROR") return "error";
  if (kind === "WARNING" || kind === "MANDATORY_WARNING") return "warning";
  return "info";
};

const mergeGraph = (target: ArchitectureGraph, source: ArchitectureGraph): void => {
  for (const node of source.nodes) target.addNode(node);
  for (const edge of source.edges) target.addEdge(edge);
};

export const createJavaArchitectureScanner = (
  loadEvidence: JavaSemanticEvidenceLoader,
): ArchitectureScanner => ({
  async scan({ projectPath }) {
    const evidence = await loadEvidence(projectPath);
    const graph = detectJavaDomainEventGraph(evidence);
    mergeGraph(graph, detectJavaHttpCommandGraph(evidence));
    mergeGraph(graph, detectJavaIntegrationEventGraph(evidence));
    mergeGraph(graph, detectJavaProjectionGraph(evidence));
    return {
      graph,
      diagnostics: evidence.diagnostics.map(({ kind, message, source }) => ({
        severity: diagnosticSeverity(kind),
        message,
        ...(source ? { sourceLocation: { file: source.file, line: source.line } } : {}),
      })),
    };
  },
});
