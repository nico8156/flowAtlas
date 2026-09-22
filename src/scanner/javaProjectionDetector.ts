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
  scope: string | null;
  handlerSource: JavaSourceLocation;
  mutationSource: JavaSourceLocation;
  syncSource: JavaSourceLocation | null;
};

export type JavaProjectionEvidence = {
  projectionUpdates: readonly JavaProjectionUpdateEvidence[];
};

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaProjectionGraph = (evidence: JavaProjectionEvidence): ArchitectureGraph => {
  const graph = createArchitectureGraph();

  for (const update of evidence.projectionUpdates) {
    if (!update.handlerSource.inScanScope || !update.mutationSource.inScanScope) {
      continue;
    }

    const eventId = `java-domain-event:${update.eventType}`;

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
    graph.addEdge({
      source: eventId,
      target: update.projection,
      kind: "UPDATES",
      sourceLocation: graphLocation(update.mutationSource),
    });
    if (update.syncSource?.inScanScope && update.scope !== null) {
      const syncEventId = `sync:${update.projection}:${update.scope}`;
      graph.addNode({
        id: syncEventId,
        kind: "Event",
        sourceLocation: graphLocation(update.syncSource),
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
  }

  return graph;
};
