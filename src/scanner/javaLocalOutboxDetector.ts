import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & { inScanScope: boolean };

export type JavaLocalOutboxEvidence = {
  localOutboxConsumers?: readonly {
    handler: string;
    eventType: string;
    handlerSource: JavaSourceLocation;
    routeSource: JavaSourceLocation;
    dispatcherSource: JavaSourceLocation;
  }[];
};

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaLocalOutboxGraph = (
  evidence: JavaLocalOutboxEvidence,
): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  for (const consumer of evidence.localOutboxConsumers ?? []) {
    if (
      !consumer.handlerSource.inScanScope ||
      !consumer.routeSource.inScanScope ||
      !consumer.dispatcherSource.inScanScope
    )
      continue;

    const eventId = `local-outbox:${consumer.eventType}`;
    graph.addNode({
      id: eventId,
      kind: "Event",
      sourceLocation: graphLocation(consumer.routeSource),
    });
    graph.addNode({
      id: consumer.handler,
      kind: "Handler",
      sourceLocation: graphLocation(consumer.handlerSource),
    });
    graph.addEdge({
      source: consumer.handler,
      target: eventId,
      kind: "LISTENS_TO",
      sourceLocation: graphLocation(consumer.routeSource),
    });
  }
  return graph;
};
