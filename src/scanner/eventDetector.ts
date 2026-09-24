import * as ts from "typescript";

import { type ArchitectureGraph, type SourceLocation } from "../domain/architectureGraph.js";
import { type EventIds } from "./projectSymbolResolver.js";
import { getExternalProtocolEventId } from "./externalProtocolEvent.js";
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

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createSlice" &&
      variableCall.call.arguments[0] &&
      ts.isObjectLiteralExpression(variableCall.call.arguments[0])
    ) {
      const reducers = variableCall.call.arguments[0].properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.name) &&
          property.name.text === "reducers" &&
          ts.isObjectLiteralExpression(property.initializer),
      );
      const reducerProperties =
        reducers && ts.isObjectLiteralExpression(reducers.initializer)
          ? reducers.initializer.properties
          : [];
      for (const reducer of reducerProperties) {
        if (!ts.isPropertyAssignment(reducer) || !ts.isIdentifier(reducer.name)) continue;
        const line =
          sourceFile.getLineAndCharacterOfPosition(reducer.getStart(sourceFile)).line + 1;
        graph.addNode({
          id:
            eventIds.get(`${file.replaceAll("\\", "/")}#${reducer.name.text}`) ?? reducer.name.text,
          kind: "Event",
          sourceLocation: { file, line },
        });
      }
    }

    const externalProtocolEventId = getExternalProtocolEventId(node);
    if (externalProtocolEventId === "projection.updated") {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      graph.addNode({
        id: externalProtocolEventId,
        kind: "Event",
        source: "external-protocol",
        sourceLocation: { file, line },
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
  return graph.findNode(eventId)?.kind === "Event" ? eventId : undefined;
};
