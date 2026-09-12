import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & { inScanScope: boolean };

export type JavaScheduledEvidence = {
  scheduledHandlers: readonly {
    handler: string;
    method: string;
    source: JavaSourceLocation;
  }[];
};

export const detectJavaScheduledGraph = (evidence: JavaScheduledEvidence): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  for (const scheduled of evidence.scheduledHandlers) {
    if (!scheduled.source.inScanScope) continue;
    const event = `protocol:scheduled:${scheduled.handler}#${scheduled.method}`;
    graph.addNode({ id: event, kind: "Event", sourceLocation: scheduled.source });
    graph.addNode({ id: scheduled.handler, kind: "Handler", sourceLocation: scheduled.source });
    graph.addEdge({
      source: scheduled.handler,
      target: event,
      kind: "LISTENS_TO",
      sourceLocation: scheduled.source,
    });
  }
  return graph;
};
