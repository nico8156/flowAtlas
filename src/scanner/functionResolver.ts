import * as ts from "typescript";

export type FunctionLike = {
  parameters: readonly ts.ParameterDeclaration[];
  body: ts.Node;
  returnType?: ts.TypeNode | undefined;
  sourceFile: ts.SourceFile;
};

export const findFunctionLike = (
  sourceFile: ts.SourceFile,
  functionName: string,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): FunctionLike | undefined => {
  let declaration: FunctionLike | undefined;
  const visit = (node: ts.Node, origin: ts.SourceFile): void => {
    if (declaration) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      if (node.body) {
        declaration = {
          parameters: node.parameters,
          body: node.body,
          returnType: node.type,
          sourceFile: origin,
        };
      }
      return;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === functionName &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      declaration = {
        parameters: node.initializer.parameters,
        body: node.initializer.body,
        returnType: node.initializer.type,
        sourceFile: origin,
      };
      return;
    }

    ts.forEachChild(node, (child) => visit(child, origin));
  };

  for (const candidate of sourceFiles) {
    visit(candidate, candidate);
    if (declaration) break;
  }
  return declaration;
};
