import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";

type JavaSourceLocation = SourceLocation & {
  inScanScope: boolean;
};

type JavaExternalCallEvidence = {
  handler: string;
  port: string;
  adapter: string;
  external: string;
  handlerSource: JavaSourceLocation;
  factorySource: JavaSourceLocation;
  adapterSource: JavaSourceLocation;
  externalSource: JavaSourceLocation;
};

export type JavaExternalEvidence = {
  externalCalls: readonly JavaExternalCallEvidence[];
};

const graphLocation = ({ file, line }: JavaSourceLocation): SourceLocation => ({ file, line });

export const detectJavaExternalGraph = (evidence: JavaExternalEvidence): ArchitectureGraph => {
  const graph = createArchitectureGraph();

  for (const call of evidence.externalCalls) {
    if (
      !call.handlerSource.inScanScope ||
      !call.factorySource.inScanScope ||
      !call.adapterSource.inScanScope ||
      !call.externalSource.inScanScope
    ) {
      continue;
    }

    graph.addNode({
      id: call.handler,
      kind: "Handler",
      sourceLocation: graphLocation(call.handlerSource),
    });
    graph.addNode({
      id: call.external,
      kind: "External",
      sourceLocation: graphLocation(call.externalSource),
    });
    graph.addEdge({
      source: call.handler,
      target: call.external,
      kind: "CALLS_EXTERNAL",
      sourceLocation: graphLocation(call.handlerSource),
    });
  }

  return graph;
};
