import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & {
  inScanScope: boolean;
};

type JavaIntegrationEventMappingEvidence = {
  producerEvent: string;
  aggregateType: string;
  destination: string;
  eventType: string;
  version: number;
  sender: string;
  senderSource: JavaSourceLocation;
  aggregateSource: JavaSourceLocation;
  destinationSource: JavaSourceLocation;
  typeSource: JavaSourceLocation;
  versionSource: JavaSourceLocation;
};

type JavaIntegrationEventConsumerEvidence = {
  handler: string;
  destination: string;
  eventType: string;
  inboxBacked: boolean;
  inboxSource: JavaSourceLocation;
  source: JavaSourceLocation;
};

export type JavaIntegrationEventEvidence = {
  integrationEventMappings: readonly JavaIntegrationEventMappingEvidence[];
  integrationEventConsumers: readonly JavaIntegrationEventConsumerEvidence[];
};

const integrationEventId = ({
  destination,
  eventType,
  version,
}: Pick<JavaIntegrationEventMappingEvidence, "destination" | "eventType" | "version">): string =>
  `integration:${destination}:${eventType}:v${version}`;

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaIntegrationEventGraph = (
  evidence: JavaIntegrationEventEvidence,
): ArchitectureGraph => {
  const graph = createArchitectureGraph();

  for (const mapping of evidence.integrationEventMappings) {
    if (
      !mapping.senderSource.inScanScope ||
      !mapping.aggregateSource.inScanScope ||
      !mapping.destinationSource.inScanScope ||
      !mapping.typeSource.inScanScope ||
      !mapping.versionSource.inScanScope
    ) {
      continue;
    }

    const eventId = integrationEventId(mapping);
    graph.addNode({
      id: eventId,
      kind: "Event",
      sourceLocation: graphLocation(mapping.destinationSource),
    });
    graph.addNode({
      id: mapping.sender,
      kind: "Handler",
      sourceLocation: graphLocation(mapping.senderSource),
    });
    graph.addEdge({
      source: mapping.sender,
      target: eventId,
      kind: "DISPATCHES",
      sourceLocation: graphLocation(mapping.senderSource),
    });

    for (const consumer of evidence.integrationEventConsumers) {
      if (
        !consumer.source.inScanScope ||
        !consumer.inboxBacked ||
        !consumer.inboxSource.inScanScope ||
        consumer.destination !== mapping.destination ||
        consumer.eventType !== mapping.eventType
      ) {
        continue;
      }
      graph.addNode({
        id: consumer.handler,
        kind: "Handler",
        sourceLocation: graphLocation(consumer.source),
      });
      graph.addEdge({
        source: consumer.handler,
        target: eventId,
        kind: "LISTENS_TO",
        sourceLocation: graphLocation(consumer.source),
      });
    }
  }

  return graph;
};
