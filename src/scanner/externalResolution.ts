import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";
import { findFunctionLike, type FunctionLike } from "./functionResolver.js";
import { type SemanticIndex } from "./semanticIndex.js";

export const getExternalIdsReturnedByFunction = (
  declaration: FunctionLike,
  graph: ArchitectureGraph,
  sourceFile: ts.SourceFile,
  visitedAliases: Set<string>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
  semanticIndex?: SemanticIndex,
): string[] => {
  if (declaration.returnType) {
    return getExternalTypeNames(
      declaration.returnType,
      graph,
      sourceFile,
      visitedAliases,
      sourceFiles,
      semanticIndex,
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
              semanticIndex,
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
  semanticIndex?: SemanticIndex,
): string[] => {
  if (!typeNode) return [];
  if (ts.isUnionTypeNode(typeNode)) {
    return [
      ...new Set(
        typeNode.types.flatMap((member) =>
          getExternalTypeNames(
            member,
            graph,
            sourceFile,
            visitedAliases,
            sourceFiles,
            semanticIndex,
          ),
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
    const declaration = findFunctionLike(
      sourceFile,
      returnTypeArgument.exprName.text,
      sourceFiles,
      semanticIndex,
    );
    if (!declaration) return [];
    return getExternalIdsReturnedByFunction(
      declaration,
      graph,
      sourceFile,
      visitedAliases,
      sourceFiles,
      semanticIndex,
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
  return getExternalTypeNames(
    aliasedType,
    graph,
    sourceFile,
    visitedAliases,
    sourceFiles,
    semanticIndex,
  );
};

export const getExternalReference = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  expression: ts.Expression,
  semanticIndex?: SemanticIndex,
): string | undefined => {
  if (!ts.isIdentifier(expression)) return undefined;
  let externalId: string | undefined;
  const visit = (node: ts.Node): void => {
    const externalTypeName = ts.isVariableDeclaration(node)
      ? getExternalTypeNames(
          node.type,
          graph,
          sourceFile,
          new Set(),
          [sourceFile],
          semanticIndex,
        )[0]
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
  semanticIndex?: SemanticIndex,
): boolean => {
  if (semanticIndex) return semanticIndex.externalSupportsMethod(externalId, methodName);

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

const getExternalProperties = (
  typeNode: ts.TypeNode | undefined,
  graph: ArchitectureGraph,
  sourceFile: ts.SourceFile,
  sourceFiles: readonly ts.SourceFile[],
  semanticIndex?: SemanticIndex,
): Array<[string, string[]]> => {
  const getMembers = (currentType: ts.TypeNode | undefined): readonly ts.TypeElement[] => {
    if (!currentType) return [];
    if (ts.isUnionTypeNode(currentType)) {
      return currentType.types.flatMap((member) => getMembers(member));
    }
    if (ts.isTypeLiteralNode(currentType)) return currentType.members;
    if (ts.isTypeReferenceNode(currentType) && ts.isIdentifier(currentType.typeName)) {
      const typeName = currentType.typeName.text;
      if (typeName === "Partial" && currentType.typeArguments?.length === 1) {
        return getMembers(currentType.typeArguments[0]);
      }
      const declaration = sourceFiles
        .flatMap((candidate) => [...candidate.statements])
        .find(
          (statement): statement is ts.TypeAliasDeclaration | ts.InterfaceDeclaration =>
            (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
            statement.name.text === typeName,
        );
      if (declaration && ts.isInterfaceDeclaration(declaration)) return declaration.members;
      return getMembers(declaration?.type);
    }
    if (ts.isIndexedAccessTypeNode(currentType)) {
      const index = currentType.indexType;
      const propertyName =
        ts.isLiteralTypeNode(index) && ts.isStringLiteral(index.literal)
          ? index.literal.text
          : undefined;
      const property = getMembers(currentType.objectType).find(
        (member): member is ts.PropertySignature =>
          ts.isPropertySignature(member) &&
          ts.isIdentifier(member.name) &&
          member.name.text === propertyName,
      );
      return getMembers(property?.type);
    }
    return [];
  };

  return getMembers(typeNode).flatMap((member): Array<[string, string[]]> => {
    if (!ts.isPropertySignature(member) || !member.name || !ts.isIdentifier(member.name)) {
      return [];
    }

    const externalIds = getExternalTypeNames(
      member.type,
      graph,
      sourceFile,
      new Set(),
      sourceFiles,
      semanticIndex,
    );
    return externalIds.length > 0 ? [[member.name.text, externalIds]] : [];
  });
};

const getReturnedFunctionParameterType = (
  functionLike: FunctionLike,
  parameterIndex: number,
  sourceFiles: readonly ts.SourceFile[],
): ts.TypeNode | undefined => {
  const returnType = functionLike.factoryReturnType;
  if (!returnType || !ts.isTypeReferenceNode(returnType) || !ts.isIdentifier(returnType.typeName)) {
    return undefined;
  }
  const findTypeAlias = (name: string): ts.TypeAliasDeclaration | undefined =>
    sourceFiles
      .flatMap((candidate) => [...candidate.statements])
      .find(
        (statement): statement is ts.TypeAliasDeclaration =>
          ts.isTypeAliasDeclaration(statement) && statement.name.text === name,
      );

  const resolveParameterType = (
    typeNode: ts.TypeNode,
    visitedAliases = new Set<string>(),
  ): ts.TypeNode | undefined => {
    if (ts.isFunctionTypeNode(typeNode)) {
      return typeNode.parameters[parameterIndex]?.type;
    }
    if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) {
      return undefined;
    }

    const typeName = typeNode.typeName.text;
    if (visitedAliases.has(typeName)) return undefined;
    visitedAliases.add(typeName);

    const typeAlias = findTypeAlias(typeName);
    if (!typeAlias) return typeNode.typeArguments?.[parameterIndex];
    if (ts.isFunctionTypeNode(typeAlias.type)) {
      return typeAlias.type.parameters[parameterIndex]?.type;
    }
    if (ts.isTypeReferenceNode(typeAlias.type) && typeAlias.type.typeArguments) {
      return typeAlias.type.typeArguments[parameterIndex];
    }
    return resolveParameterType(typeAlias.type, visitedAliases);
  };

  return resolveParameterType(returnType);
};

export const getExternalParametersPassedToFunction = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  localExternalIds: ReadonlyMap<string, string[]>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
  semanticIndex?: SemanticIndex,
): Map<string, string[]> => {
  const passedExternalParameters = new Map<string, string[]>();
  const calledDeclaration = ts.isIdentifier(call.expression)
    ? findFunctionLike(sourceFile, call.expression.text, sourceFiles, semanticIndex)
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

const getExternalIdsCalledByResolvedFunction = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  functionName: string,
  functionLike: FunctionLike,
  visitedFunctions = new Set<string>(),
  inheritedExternalParameters = new Map<string, string[]>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
  semanticIndex?: SemanticIndex,
): string[] => {
  if (visitedFunctions.has(functionName)) return [];
  visitedFunctions.add(functionName);
  const { parameters, body } = functionLike;
  const externalParameters = new Map<string, string[]>();
  for (const [parameterKey, externalIds] of inheritedExternalParameters) {
    externalParameters.set(parameterKey, externalIds);
  }
  const localExternalIds = new Map<string, string[]>();
  for (const [parameterIndex, parameter] of parameters.entries()) {
    const parameterType =
      parameter.type ?? getReturnedFunctionParameterType(functionLike, parameterIndex, sourceFiles);
    const externalTypeNames = getExternalTypeNames(
      parameterType,
      graph,
      sourceFile,
      new Set(),
      sourceFiles,
      semanticIndex,
    );
    if (ts.isIdentifier(parameter.name) && externalTypeNames.length > 0) {
      externalParameters.set(parameter.name.text, externalTypeNames);
    }
    if (ts.isIdentifier(parameter.name) && parameterType) {
      for (const [propertyName, externalIds] of getExternalProperties(
        parameterType,
        graph,
        sourceFile,
        sourceFiles,
        semanticIndex,
      )) {
        externalParameters.set(`${parameter.name.text}.${propertyName}`, externalIds);
      }
    }
  }

  const externalIds = new Set<string>();
  const visitBody = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      if (ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)) {
        const declaration = findFunctionLike(
          sourceFile,
          node.initializer.expression.text,
          sourceFiles,
          semanticIndex,
        );
        if (declaration) {
          localExternalIds.set(
            node.name.text,
            getExternalIdsReturnedByFunction(
              declaration,
              graph,
              sourceFile,
              new Set(),
              sourceFiles,
              semanticIndex,
            ),
          );
        }
      } else if (ts.isPropertyAccessExpression(node.initializer)) {
        const object = node.initializer.expression;
        const parameterKey = ts.isIdentifier(object)
          ? `${object.text}.${node.initializer.name.text}`
          : undefined;
        if (parameterKey) {
          const resolvedExternalIds = externalParameters.get(parameterKey) ?? [];
          if (resolvedExternalIds.length > 0) {
            localExternalIds.set(node.name.text, resolvedExternalIds);
          }
        }
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
        const resolvedExternalIds =
          externalParameters.get(parameterKey) ?? localExternalIds.get(parameterKey) ?? [];
        for (const externalId of resolvedExternalIds) {
          if (
            externalSupportsMethod(
              sourceFile,
              externalId,
              node.name.text,
              sourceFiles,
              semanticIndex,
            )
          ) {
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
        semanticIndex,
      );
      for (const externalId of getExternalIdsCalledByFunction(
        sourceFile,
        graph,
        node.expression.text,
        visitedFunctions,
        passedExternalParameters,
        sourceFiles,
        semanticIndex,
      )) {
        externalIds.add(externalId);
      }
    }
    ts.forEachChild(node, visitBody);
  };
  visitBody(body);
  return [...externalIds];
};

export const getExternalIdsCalledByFunction = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  functionName: string,
  visitedFunctions = new Set<string>(),
  inheritedExternalParameters = new Map<string, string[]>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
  semanticIndex?: SemanticIndex,
): string[] => {
  const functionLike = findFunctionLike(sourceFile, functionName, sourceFiles, semanticIndex);
  if (!functionLike) return [];

  return getExternalIdsCalledByResolvedFunction(
    sourceFile,
    graph,
    functionName,
    functionLike,
    visitedFunctions,
    inheritedExternalParameters,
    sourceFiles,
    semanticIndex,
  );
};

export const getExternalIdsCalledByFunctionLike = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  functionName: string,
  functionLike: FunctionLike,
  visitedFunctions = new Set<string>(),
  inheritedExternalParameters = new Map<string, string[]>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
  semanticIndex?: SemanticIndex,
): string[] =>
  getExternalIdsCalledByResolvedFunction(
    sourceFile,
    graph,
    functionName,
    functionLike,
    visitedFunctions,
    inheritedExternalParameters,
    sourceFiles,
    semanticIndex,
  );
