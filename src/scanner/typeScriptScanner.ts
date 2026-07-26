import * as ts from "typescript";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";

type TypeScriptSource = {
  file: string;
  source: string;
};

type VariableCall = {
  id: string;
  call: ts.CallExpression;
};

const getVariableCall = (node: ts.Node): VariableCall | undefined => {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isIdentifier(node.name) ||
    !node.initializer ||
    !ts.isCallExpression(node.initializer)
  ) {
    return undefined;
  }

  return { id: node.name.text, call: node.initializer };
};

export const scanTypeScriptSource = ({ source }: TypeScriptSource): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const sourceFile = ts.createSourceFile(
    "flowatlas-input.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createAction"
    ) {
      graph.addNode({ id: variableCall.id, kind: "Event" });
    }

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "startListening"
    ) {
      const handlerId = variableCall.id;
      graph.addNode({ id: handlerId, kind: "Handler" });

      const configuration = variableCall.call.arguments[0];
      if (configuration && ts.isObjectLiteralExpression(configuration)) {
        const actionCreatorProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "actionCreator",
        );

        if (actionCreatorProperty && ts.isIdentifier(actionCreatorProperty.initializer)) {
          graph.addEdge({
            source: handlerId,
            target: actionCreatorProperty.initializer.text,
            kind: "LISTENS_TO",
          });
        }

        const effectProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "effect",
        );

        if (effectProperty) {
          const visitEffect = (effectNode: ts.Node): void => {
            if (
              ts.isCallExpression(effectNode) &&
              ts.isPropertyAccessExpression(effectNode.expression) &&
              effectNode.expression.name.text === "dispatch"
            ) {
              const dispatchedAction = effectNode.arguments[0];
              if (
                dispatchedAction &&
                ts.isCallExpression(dispatchedAction) &&
                ts.isIdentifier(dispatchedAction.expression)
              ) {
                graph.addEdge({
                  source: handlerId,
                  target: dispatchedAction.expression.text,
                  kind: "DISPATCHES",
                });
              }
            }

            ts.forEachChild(effectNode, visitEffect);
          };

          visitEffect(effectProperty.initializer);
        }
      }
    }

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createSlice"
    ) {
      const stateId = variableCall.id;
      graph.addNode({ id: stateId, kind: "State" });

      const configuration = variableCall.call.arguments[0];
      if (configuration && ts.isObjectLiteralExpression(configuration)) {
        const extraReducersProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "extraReducers",
        );

        if (extraReducersProperty) {
          const visitExtraReducers = (reducerNode: ts.Node): void => {
            if (
              ts.isCallExpression(reducerNode) &&
              ts.isPropertyAccessExpression(reducerNode.expression) &&
              reducerNode.expression.name.text === "addCase"
            ) {
              const handledEvent = reducerNode.arguments[0];
              if (handledEvent && ts.isIdentifier(handledEvent)) {
                graph.addEdge({
                  source: handledEvent.text,
                  target: stateId,
                  kind: "UPDATES",
                });
              }
            }

            ts.forEachChild(reducerNode, visitExtraReducers);
          };

          visitExtraReducers(extraReducersProperty.initializer);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return graph;
};
