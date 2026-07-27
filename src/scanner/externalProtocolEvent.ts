import * as ts from "typescript";

export const getExternalProtocolEventId = (node: ts.Node): string | undefined => {
  if (
    !ts.isBinaryExpression(node) ||
    (node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
      node.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsEqualsToken) ||
    !ts.isPropertyAccessExpression(node.left) ||
    node.left.name.text !== "eventName" ||
    !ts.isStringLiteral(node.right)
  ) {
    return undefined;
  }

  return node.right.text;
};
