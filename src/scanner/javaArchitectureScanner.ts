import type {
  ArchitectureScanDiagnostic,
  ArchitectureScanner,
  ArchitectureNodeDiscoveryAlias,
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
import { detectJavaExternalGraph, type JavaExternalEvidence } from "./javaExternalDetector.js";
import { detectJavaScheduledGraph, type JavaScheduledEvidence } from "./javaScheduledDetector.js";
import {
  detectJavaLocalOutboxGraph,
  type JavaLocalOutboxEvidence,
} from "./javaLocalOutboxDetector.js";

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
  } & JavaProjectionEvidence &
  JavaExternalEvidence &
  JavaScheduledEvidence &
  JavaLocalOutboxEvidence;

type JavaSemanticEvidenceLoader = (
  projectPath: string,
  requestPath: string | undefined,
) => Promise<JavaSemanticEvidence>;

const diagnosticSeverity = (kind: string): ArchitectureScanDiagnostic["severity"] => {
  if (kind === "ERROR") return "error";
  if (kind === "WARNING" || kind === "MANDATORY_WARNING") return "warning";
  return "info";
};

const mergeGraph = (target: ArchitectureGraph, source: ArchitectureGraph): void => {
  for (const node of source.nodes) target.addNode(node);
  for (const edge of source.edges) target.addEdge(edge);
};

const integrationDiscoveryAliases = (
  evidence: JavaIntegrationEventEvidence,
): readonly ArchitectureNodeDiscoveryAlias[] =>
  evidence.integrationEventMappings
    .filter(
      (mapping) =>
        mapping.senderSource.inScanScope &&
        mapping.aggregateSource.inScanScope &&
        mapping.destinationSource.inScanScope &&
        mapping.typeSource.inScanScope &&
        mapping.versionSource.inScanScope,
    )
    .map((mapping) => ({
      nodeId: `integration:${mapping.destination}:${mapping.eventType}:v${mapping.version}`,
      aliases: [mapping.producerEvent, mapping.eventType],
    }));

export const createJavaArchitectureScanner = (
  loadEvidence: JavaSemanticEvidenceLoader,
): ArchitectureScanner => ({
  async scan({ projectPath, requestPath }) {
    const evidence = await loadEvidence(projectPath, requestPath);
    const graph = detectJavaDomainEventGraph(evidence);
    mergeGraph(graph, detectJavaHttpCommandGraph(evidence));
    mergeGraph(graph, detectJavaIntegrationEventGraph(evidence));
    mergeGraph(graph, detectJavaProjectionGraph(evidence));
    mergeGraph(graph, detectJavaExternalGraph(evidence));
    mergeGraph(graph, detectJavaScheduledGraph(evidence));
    mergeGraph(graph, detectJavaLocalOutboxGraph(evidence));
    return {
      graph,
      diagnostics: evidence.diagnostics.map(({ kind, message, source }) => ({
        severity: diagnosticSeverity(kind),
        message,
        ...(source ? { sourceLocation: { file: source.file, line: source.line } } : {}),
      })),
      discoveryAliases: integrationDiscoveryAliases(evidence),
    };
  },
});
