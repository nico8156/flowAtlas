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

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return graph;
};
