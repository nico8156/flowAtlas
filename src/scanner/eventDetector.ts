import * as ts from "typescript";

import { type ArchitectureGraph, type SourceLocation } from "../domain/architectureGraph.js";
import { type EventIds } from "./projectSymbolResolver.js";
import { getVariableCall } from "./typeScriptAst.js";

export const detectEvents = (
  sourceFile: ts.SourceFile,
  file: string,
  graph: ArchitectureGraph,
  eventIds: EventIds,
): void => {
  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);
    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createAction"
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const sourceLocation: SourceLocation = { file, line };

      graph.addNode({
        id: eventIds.get(`${file.replaceAll("\\", "/")}#${variableCall.id}`) ?? variableCall.id,
        kind: "Event",
        sourceLocation,
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

export const getResolvedEventId = (
  graph: ArchitectureGraph,
  localName: string,
  bindings: ReadonlyMap<string, string>,
): string | undefined => {
  const eventId = bindings.get(localName) ?? localName;
  return graph.nodes.some((node) => node.id === eventId && node.kind === "Event")
    ? eventId
    : undefined;
};
