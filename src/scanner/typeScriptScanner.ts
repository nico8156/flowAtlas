import * as ts from "typescript";

import { createArchitectureGraph, type ArchitectureGraph } from "../domain/architectureGraph.js";

type TypeScriptSource = {
  file: string;
  source: string;
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
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "createAction"
    ) {
      graph.addNode({ id: node.name.text, kind: "Event" });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "startListening"
    ) {
      const handlerId = node.name.text;
      graph.addNode({ id: handlerId, kind: "Handler" });

      const configuration = node.initializer.arguments[0];
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

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return graph;
};
