import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & {
  inScanScope: boolean;
};

type JavaDomainEventTypeEvidence = {
  qualifiedName: string;
  assignableToDomainEvent: boolean;
  source: JavaSourceLocation;
};

export type JavaDomainEventEvidence = {
  types: readonly JavaDomainEventTypeEvidence[];
  handler: {
    qualifiedName: string;
    eventType: string;
    source: JavaSourceLocation;
  } | null;
  domainEventPublications: readonly {
    owner: string;
    method: string;
    caller: string;
    argumentType: string;
    source: JavaSourceLocation;
  }[];
};

const eventId = (qualifiedName: string): string => `java-domain-event:${qualifiedName}`;

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

const declaringType = (method: string): string => method.slice(0, method.indexOf("#"));

export const detectJavaDomainEventGraph = (
  evidence: JavaDomainEventEvidence,
): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const handler = evidence.handler;
  if (!handler) return graph;
  const listenedEvent = evidence.types.find(
    (type) => type.qualifiedName === handler.eventType && type.assignableToDomainEvent,
  );

  if (!handler.source.inScanScope || !listenedEvent) return graph;

  const handlerId = handler.qualifiedName;
  const listenedEventId = eventId(listenedEvent.qualifiedName);
  graph.addNode({
    id: listenedEventId,
    kind: "Event",
    sourceLocation: graphLocation(listenedEvent.source),
  });
  graph.addNode({
    id: handlerId,
    kind: "Handler",
    sourceLocation: graphLocation(handler.source),
  });
  graph.addEdge({
    source: handlerId,
    target: listenedEventId,
    kind: "LISTENS_TO",
    sourceLocation: graphLocation(handler.source),
  });

  for (const publication of evidence.domainEventPublications) {
    if (
      !publication.source.inScanScope ||
      declaringType(publication.caller) !== handler.qualifiedName
    ) {
      continue;
    }

    const publishedEvent = evidence.types.find(
      (type) => type.qualifiedName === publication.argumentType && type.assignableToDomainEvent,
    );
    if (!publishedEvent) continue;

    const publishedEventId = eventId(publishedEvent.qualifiedName);
    graph.addNode({
      id: publishedEventId,
      kind: "Event",
      sourceLocation: graphLocation(publishedEvent.source),
    });
    graph.addEdge({
      source: handlerId,
      target: publishedEventId,
      kind: "DISPATCHES",
      sourceLocation: graphLocation(publication.source),
    });
  }

  return graph;
};
