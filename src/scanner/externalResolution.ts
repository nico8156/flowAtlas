import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";
import { findFunctionLike, type FunctionLike } from "./functionResolver.js";

export const getExternalIdsReturnedByFunction = (
  declaration: FunctionLike,
  graph: ArchitectureGraph,
  sourceFile: ts.SourceFile,
  visitedAliases: Set<string>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): string[] => {
  if (declaration.returnType) {
    return getExternalTypeNames(
      declaration.returnType,
      graph,
      sourceFile,
      visitedAliases,
      sourceFiles,
    );
  }

  const externalIds = new Set<string>();
  const visitReturn = (node: ts.Node): void => {
    const returnedExpression = ts.isReturnStatement(node) ? node.expression : undefined;
    if (returnedExpression && ts.isPropertyAccessExpression(returnedExpression)) {
      const object = returnedExpression.expression;
      if (ts.isIdentifier(object)) {
        const parameter = declaration.parameters.find(
          (candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === object.text,
        );
        const parameterType = parameter?.type;
        const parameterTypeMembers =
          parameterType && ts.isUnionTypeNode(parameterType)
            ? parameterType.types
            : parameterType
              ? [parameterType]
              : [];
        const parameterTypeReference = parameterTypeMembers.find(
          (member): member is ts.TypeReferenceNode =>
            ts.isTypeReferenceNode(member) && ts.isIdentifier(member.typeName),
        );
        if (parameterTypeReference) {
          const parameterTypeName = parameterTypeReference.getText();
          const typeAlias = sourceFiles
            .flatMap((candidate) => [...candidate.statements])
            .find(
              (statement): statement is ts.TypeAliasDeclaration =>
                ts.isTypeAliasDeclaration(statement) && statement.name.text === parameterTypeName,
            );
          if (typeAlias && ts.isTypeLiteralNode(typeAlias.type)) {
            const property = typeAlias.type.members.find(
              (member): member is ts.PropertySignature =>
                ts.isPropertySignature(member) &&
                ts.isIdentifier(member.name) &&
                member.name.text === returnedExpression.name.text,
            );
            for (const externalId of getExternalTypeNames(
              property?.type,
              graph,
              sourceFile,
              visitedAliases,
              sourceFiles,
            )) {
              externalIds.add(externalId);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitReturn);
  };

  visitReturn(declaration.body);
  return [...externalIds];
};

const getExternalTypeNames = (
  typeNode: ts.TypeNode | undefined,
  graph: ArchitectureGraph,
  sourceFile: ts.SourceFile,
  visitedAliases = new Set<string>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): string[] => {
  if (!typeNode) return [];
  if (ts.isUnionTypeNode(typeNode)) {
    return [
      ...new Set(
        typeNode.types.flatMap((member) =>
          getExternalTypeNames(member, graph, sourceFile, visitedAliases, sourceFiles),
        ),
      ),
    ];
  }
  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) return [];

  const typeName = typeNode.typeName.text;
  const returnTypeArgument = typeNode.typeArguments?.[0];
  if (
    typeName === "ReturnType" &&
    typeNode.typeArguments?.length === 1 &&
    returnTypeArgument &&
    ts.isTypeQueryNode(returnTypeArgument) &&
    ts.isIdentifier(returnTypeArgument.exprName)
  ) {
    const declaration = findFunctionLike(sourceFile, returnTypeArgument.exprName.text, sourceFiles);
    if (!declaration) return [];
    return getExternalIdsReturnedByFunction(
      declaration,
      graph,
      sourceFile,
      visitedAliases,
      sourceFiles,
    );
  }
  if (graph.nodes.some((candidate) => candidate.id === typeName && candidate.kind === "External")) {
    return [typeName];
  }
  if (visitedAliases.has(typeName)) return [];
  visitedAliases.add(typeName);

  let aliasedType: ts.TypeNode | undefined;
  const findAlias = (node: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
      aliasedType = node.type;
      return;
    }
    ts.forEachChild(node, findAlias);
  };
  for (const candidate of sourceFiles) {
    findAlias(candidate);
    if (aliasedType) break;
  }
  return getExternalTypeNames(aliasedType, graph, sourceFile, visitedAliases, sourceFiles);
};

export const getExternalReference = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  expression: ts.Expression,
): string | undefined => {
  if (!ts.isIdentifier(expression)) return undefined;
  let externalId: string | undefined;
  const visit = (node: ts.Node): void => {
    const externalTypeName = ts.isVariableDeclaration(node)
      ? getExternalTypeNames(node.type, graph, sourceFile)[0]
      : undefined;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === expression.text &&
      externalTypeName
    ) {
      externalId = externalTypeName;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return externalId;
};

const externalSupportsMethod = (
  sourceFile: ts.SourceFile,
  externalId: string,
  methodName: string,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): boolean => {
  let supportsMethod = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isInterfaceDeclaration(node) &&
      node.name.text === externalId &&
      node.members.some(
        (member) =>
          (ts.isMethodSignature(member) || ts.isPropertySignature(member)) &&
          member.name &&
          ts.isIdentifier(member.name) &&
          member.name.text === methodName,
      )
    ) {
      supportsMethod = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  for (const candidate of sourceFiles) {
    visit(candidate);
    if (supportsMethod) break;
  }
  return supportsMethod;
};

export const getExternalParametersPassedToFunction = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  localExternalIds: ReadonlyMap<string, string[]>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): Map<string, string[]> => {
  const passedExternalParameters = new Map<string, string[]>();
  const calledDeclaration = ts.isIdentifier(call.expression)
    ? findFunctionLike(sourceFile, call.expression.text, sourceFiles)
    : undefined;
  const firstParameter = calledDeclaration?.parameters[0];
  const firstArgument = call.arguments[0];
  if (
    !calledDeclaration ||
    !firstParameter ||
    !firstArgument ||
    !ts.isObjectLiteralExpression(firstArgument)
  ) {
    return passedExternalParameters;
  }

  if (ts.isObjectBindingPattern(firstParameter.name)) {
    for (const element of firstParameter.name.elements) {
      if (!ts.isIdentifier(element.name)) continue;
      const propertyName = element.propertyName;
      const sourceName =
        propertyName && ts.isIdentifier(propertyName) ? propertyName.text : element.name.text;
      const property = firstArgument.properties.find(
        (candidate): candidate is ts.PropertyAssignment =>
          ts.isPropertyAssignment(candidate) &&
          ts.isIdentifier(candidate.name) &&
          candidate.name.text === sourceName &&
          ts.isIdentifier(candidate.initializer),
      );
      if (!property) continue;
      const initializer = property.initializer;
      if (!ts.isIdentifier(initializer)) continue;
      const resolvedExternalIds = localExternalIds.get(initializer.text) ?? [];
      if (resolvedExternalIds.length > 0) {
        passedExternalParameters.set(element.name.text, resolvedExternalIds);
      }
    }
    return passedExternalParameters;
  }
  if (!ts.isIdentifier(firstParameter.name)) return passedExternalParameters;
  for (const property of firstArgument.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isIdentifier(property.name) ||
      !ts.isIdentifier(property.initializer)
    ) {
      continue;
    }
    const resolvedExternalIds = localExternalIds.get(property.initializer.text) ?? [];
    if (resolvedExternalIds.length > 0) {
      passedExternalParameters.set(
        `${firstParameter.name.text}.${property.name.text}`,
        resolvedExternalIds,
      );
    }
  }
  return passedExternalParameters;
};

export const getExternalIdsCalledByFunction = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  functionName: string,
  visitedFunctions = new Set<string>(),
  inheritedExternalParameters = new Map<string, string[]>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): string[] => {
  if (visitedFunctions.has(functionName)) return [];
  visitedFunctions.add(functionName);
  const functionLike = findFunctionLike(sourceFile, functionName, sourceFiles);
  if (!functionLike) return [];
  const { parameters, body } = functionLike;
  const externalParameters = new Map<string, string[]>();
  for (const [parameterKey, externalIds] of inheritedExternalParameters) {
    externalParameters.set(parameterKey, externalIds);
  }
  const localExternalIds = new Map<string, string[]>();
  for (const parameter of parameters) {
    const externalTypeNames = getExternalTypeNames(
      parameter.type,
      graph,
      sourceFile,
      new Set(),
      sourceFiles,
    );
    if (ts.isIdentifier(parameter.name) && externalTypeNames.length > 0) {
      externalParameters.set(parameter.name.text, externalTypeNames);
    }
    if (ts.isIdentifier(parameter.name) && parameter.type && ts.isTypeLiteralNode(parameter.type)) {
      for (const member of parameter.type.members) {
        if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name)) {
          continue;
        }
        const memberExternalTypeNames = getExternalTypeNames(
          member.type,
          graph,
          sourceFile,
          new Set(),
          sourceFiles,
        );
        if (memberExternalTypeNames.length > 0) {
          externalParameters.set(
            `${parameter.name.text}.${member.name.text}`,
            memberExternalTypeNames,
          );
        }
      }
    }
  }

  const externalIds = new Set<string>();
  const visitBody = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression)
    ) {
      const declaration = findFunctionLike(
        sourceFile,
        node.initializer.expression.text,
        sourceFiles,
      );
      if (declaration) {
        localExternalIds.set(
          node.name.text,
          getExternalIdsReturnedByFunction(declaration, graph, sourceFile, new Set(), sourceFiles),
        );
      }
    }
    if (ts.isPropertyAccessExpression(node) && ts.isCallExpression(node.parent)) {
      let parameterKey: string | undefined;
      if (ts.isIdentifier(node.expression)) {
        parameterKey = node.expression.text;
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression)
      ) {
        parameterKey = `${node.expression.expression.text}.${node.expression.name.text}`;
      }
      if (parameterKey) {
        const resolvedExternalIds = externalParameters.get(parameterKey) ?? [];
        for (const externalId of resolvedExternalIds) {
          if (externalSupportsMethod(sourceFile, externalId, node.name.text, sourceFiles)) {
            externalIds.add(externalId);
          }
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const passedExternalParameters = getExternalParametersPassedToFunction(
        node,
        sourceFile,
        localExternalIds,
        sourceFiles,
      );
      for (const externalId of getExternalIdsCalledByFunction(
        sourceFile,
        graph,
        node.expression.text,
        visitedFunctions,
        passedExternalParameters,
        sourceFiles,
      )) {
        externalIds.add(externalId);
      }
    }
    ts.forEachChild(node, visitBody);
  };
  visitBody(body);
  return [...externalIds];
};
