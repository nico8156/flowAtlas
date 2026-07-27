import * as ts from "typescript";

import { type FunctionLike } from "./functionResolver.js";
import { type ProjectSourceFile } from "./projectSymbolResolver.js";

export type SemanticIndex = {
  findFunctionLike(file: string, name: string): FunctionLike | undefined;
  findTypeAliases(name: string): readonly ts.TypeAliasDeclaration[];
  findInterface(name: string): ts.InterfaceDeclaration | undefined;
  externalSupportsMethod(interfaceName: string, methodName: string): boolean;
};

export const buildSemanticIndex = (sourceFiles: readonly ProjectSourceFile[]): SemanticIndex => {
  const functions = new Map<string, FunctionLike>();
  const functionsByName = new Map<string, FunctionLike[]>();
  const typeAliases = new Map<string, ts.TypeAliasDeclaration[]>();
  const interfaces = new Map<string, ts.InterfaceDeclaration>();
  const interfaceMethods = new Set<string>();

  for (const { file, sourceFile } of sourceFiles) {
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        const functionLike = {
          parameters: node.parameters,
          body: node.body,
          returnType: node.type,
          sourceFile,
        } satisfies FunctionLike;
        functions.set(`${file}#${node.name.text}`, functionLike);
        const declarations = functionsByName.get(node.name.text) ?? [];
        declarations.push(functionLike);
        functionsByName.set(node.name.text, declarations);
      }

      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ) {
        const functionLike = {
          parameters: node.initializer.parameters,
          body: node.initializer.body,
          returnType: node.initializer.type,
          sourceFile,
        } satisfies FunctionLike;
        functions.set(`${file}#${node.name.text}`, functionLike);
        const declarations = functionsByName.get(node.name.text) ?? [];
        declarations.push(functionLike);
        functionsByName.set(node.name.text, declarations);
      }

      if (ts.isTypeAliasDeclaration(node)) {
        const declarations = typeAliases.get(node.name.text) ?? [];
        declarations.push(node);
        typeAliases.set(node.name.text, declarations);
      }

      if (ts.isInterfaceDeclaration(node)) {
        interfaces.set(node.name.text, node);
        for (const member of node.members) {
          if (member.name && ts.isIdentifier(member.name)) {
            interfaceMethods.add(`${node.name.text}#${member.name.text}`);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return {
    findFunctionLike(file, name) {
      return functions.get(`${file}#${name}`) ?? functionsByName.get(name)?.[0];
    },
    findTypeAliases(name) {
      return typeAliases.get(name) ?? [];
    },
    findInterface(name) {
      return interfaces.get(name);
    },
    externalSupportsMethod(interfaceName, methodName) {
      return interfaceMethods.has(`${interfaceName}#${methodName}`);
    },
  };
};
