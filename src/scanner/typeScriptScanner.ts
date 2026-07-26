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
      graph.addNode({ id: node.name.text, kind: "Handler" });

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
            source: node.name.text,
            target: actionCreatorProperty.initializer.text,
            kind: "LISTENS_TO",
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return graph;
};
