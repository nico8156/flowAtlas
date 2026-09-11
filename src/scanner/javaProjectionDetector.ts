import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & {
  inScanScope: boolean;
};

type JavaProjectionUpdateEvidence = {
  handler: string;
  eventType: string;
  projection: string;
  scope: string;
  handlerSource: JavaSourceLocation;
  mutationSource: JavaSourceLocation;
  syncSource: JavaSourceLocation;
};

export type JavaProjectionEvidence = {
  projectionUpdates: readonly JavaProjectionUpdateEvidence[];
};

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaProjectionGraph = (evidence: JavaProjectionEvidence): ArchitectureGraph => {
  const graph = createArchitectureGraph();

  for (const update of evidence.projectionUpdates) {
    if (
      !update.handlerSource.inScanScope ||
      !update.mutationSource.inScanScope ||
      !update.syncSource.inScanScope
    ) {
      continue;
    }

    const eventId = `java-domain-event:${update.eventType}`;
    const syncEventId = `sync:${update.projection}:${update.scope}`;

    graph.addNode({
      id: eventId,
      kind: "Event",
      sourceLocation: graphLocation(update.handlerSource),
    });
    graph.addNode({
      id: update.handler,
      kind: "Handler",
      sourceLocation: graphLocation(update.handlerSource),
    });
    graph.addNode({
      id: update.projection,
      kind: "State",
      sourceLocation: graphLocation(update.mutationSource),
    });
    graph.addNode({
      id: syncEventId,
      kind: "Event",
      sourceLocation: graphLocation(update.syncSource),
    });
    graph.addEdge({
      source: eventId,
      target: update.projection,
      kind: "UPDATES",
      sourceLocation: graphLocation(update.mutationSource),
    });
    graph.addEdge({
      source: update.handler,
      target: syncEventId,
      kind: "DISPATCHES",
      sourceLocation: graphLocation(update.syncSource),
    });
    graph.addEdge({
      source: syncEventId,
      target: update.projection,
      kind: "UPDATES",
      sourceLocation: graphLocation(update.syncSource),
    });
  }

  return graph;
};
