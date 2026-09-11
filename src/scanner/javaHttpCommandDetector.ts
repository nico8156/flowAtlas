import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & {
  inScanScope: boolean;
};

export type JavaHttpCommandEvidence = {
  command: {
    qualifiedName: string;
    assignableToCommand: boolean;
    source: JavaSourceLocation;
  } | null;
  commandHandler: {
    qualifiedName: string;
    commandType: string;
    source: JavaSourceLocation;
  } | null;
  httpEndpoint: {
    controller: string;
    handler: string;
    httpMethod: string;
    path: string;
    source: JavaSourceLocation;
  } | null;
  commandDispatches: readonly {
    owner: string;
    method: string;
    caller: string;
    argumentType: string;
    source: JavaSourceLocation;
  }[];
};

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaHttpCommandGraph = (
  evidence: JavaHttpCommandEvidence,
): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const command = evidence.command;
  if (!command?.assignableToCommand) return graph;

  const commandId = `java-command:${command.qualifiedName}`;
  if (
    evidence.commandHandler?.source.inScanScope &&
    evidence.commandHandler.commandType === command.qualifiedName
  ) {
    graph.addNode({
      id: commandId,
      kind: "Event",
      sourceLocation: graphLocation(command.source),
    });
    graph.addNode({
      id: evidence.commandHandler.qualifiedName,
      kind: "Handler",
      sourceLocation: graphLocation(evidence.commandHandler.source),
    });
    graph.addEdge({
      source: evidence.commandHandler.qualifiedName,
      target: commandId,
      kind: "LISTENS_TO",
      sourceLocation: graphLocation(evidence.commandHandler.source),
    });
  }

  const endpoint = evidence.httpEndpoint;
  if (!endpoint?.source.inScanScope) return graph;

  const protocolId = `protocol:http:${endpoint.httpMethod}:${endpoint.path}`;
  graph.addNode({
    id: protocolId,
    kind: "Event",
    sourceLocation: graphLocation(endpoint.source),
  });
  graph.addNode({
    id: endpoint.handler,
    kind: "Handler",
    sourceLocation: graphLocation(endpoint.source),
  });
  graph.addEdge({
    source: endpoint.handler,
    target: protocolId,
    kind: "LISTENS_TO",
    sourceLocation: graphLocation(endpoint.source),
  });

  const dispatch = evidence.commandDispatches.find(
    (candidate) =>
      candidate.source.inScanScope &&
      candidate.caller === endpoint.handler &&
      candidate.argumentType === command.qualifiedName,
  );
  if (!dispatch) return graph;

  graph.addNode({
    id: commandId,
    kind: "Event",
    sourceLocation: graphLocation(command.source),
  });
  graph.addEdge({
    source: endpoint.handler,
    target: commandId,
    kind: "DISPATCHES",
    sourceLocation: graphLocation(dispatch.source),
  });

  return graph;
};
