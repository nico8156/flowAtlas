import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";

export const detectExternalNodes = (sourceFile: ts.SourceFile, graph: ArchitectureGraph): void => {
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith("Gateway")) {
      graph.addNode({ id: node.name.text, kind: "External" });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};
