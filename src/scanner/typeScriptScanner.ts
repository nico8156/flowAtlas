import * as ts from "typescript";

import {
  createArchitectureGraph,
  type ArchitectureGraph,
  type SourceLocation,
} from "../domain/architectureGraph.js";
import {
  resolveProjectSymbols,
  type EventIds,
  type SymbolBindings,
  type TypeScriptProject,
  type TypeScriptSource,
} from "./projectSymbolResolver.js";

type VariableCall = {
  id: string;
  call: ts.CallExpression;
};

type StateIds = ReadonlyMap<string, string>;

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

const createTypeScriptSourceFile = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const getActionCreatorReference = (
  configuration: ts.ObjectLiteralExpression,
): string | undefined => {
  const actionCreatorProperty = configuration.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "actionCreator",
  );

  return actionCreatorProperty && ts.isIdentifier(actionCreatorProperty.initializer)
    ? actionCreatorProperty.initializer.text
    : undefined;
};

const addListeningRelationship = (
  graph: ArchitectureGraph,
  handlerId: string,
  configuration: ts.ObjectLiteralExpression,
  bindings: SymbolBindings,
  collectRelationships: boolean,
): void => {
  graph.addNode({ id: handlerId, kind: "Handler" });
  if (!collectRelationships) return;

  const actionCreator = getActionCreatorReference(configuration);
  if (!actionCreator) return;

  graph.addEdge({
    source: handlerId,
    target: bindings.get(actionCreator) ?? actionCreator,
    kind: "LISTENS_TO",
  });
};

const getResolvedEventId = (
  graph: ArchitectureGraph,
  localName: string,
  bindings: SymbolBindings,
): string | undefined => {
  const eventId = bindings.get(localName) ?? localName;
  return graph.nodes.some((node) => node.id === eventId && node.kind === "Event")
    ? eventId
    : undefined;
};

const addDispatchRelationships = (
  graph: ArchitectureGraph,
  handlerId: string,
  configuration: ts.ObjectLiteralExpression,
  bindings: SymbolBindings,
  collectRelationships: boolean,
): void => {
  if (!collectRelationships) return;

  const effectProperty = configuration.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "effect",
  );

  if (!effectProperty) return;

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
        const target = getResolvedEventId(graph, dispatchedAction.expression.text, bindings);
        if (!target) {
          return;
        }

        graph.addEdge({
          source: handlerId,
          target,
          kind: "DISPATCHES",
        });
      }
    }

    ts.forEachChild(effectNode, visitEffect);
  };

  visitEffect(effectProperty.initializer);
};

const findFunctionDeclaration = (
  sourceFile: ts.SourceFile,
  functionName: string,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): ts.FunctionDeclaration | undefined => {
  let declaration: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (declaration) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      declaration = node;
      return;
    }

    ts.forEachChild(node, visit);
  };

  for (const candidate of sourceFiles) {
    visit(candidate);
    if (declaration) break;
  }
  return declaration;
};

const getExternalIdsReturnedByFunction = (
  declaration: ts.FunctionDeclaration,
  graph: ArchitectureGraph,
  sourceFile: ts.SourceFile,
  visitedAliases: Set<string>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): string[] => {
  if (!declaration.body) return [];

  if (declaration.type) {
    return getExternalTypeNames(declaration.type, graph, sourceFile, visitedAliases, sourceFiles);
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

  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) {
    return [];
  }

  const typeName = typeNode.typeName.text;
  const returnTypeArgument = typeNode.typeArguments?.[0];
  if (
    typeName === "ReturnType" &&
    typeNode.typeArguments?.length === 1 &&
    returnTypeArgument &&
    ts.isTypeQueryNode(returnTypeArgument) &&
    ts.isIdentifier(returnTypeArgument.exprName)
  ) {
    const functionName = returnTypeArgument.exprName.text;
    const declaration = findFunctionDeclaration(sourceFile, functionName, sourceFiles);
    if (!declaration?.body) return [];

    if (declaration.type) {
      return getExternalTypeNames(declaration.type, graph, sourceFile, visitedAliases, sourceFiles);
    }

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

const getExternalReference = (
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

const getExternalParametersPassedToFunction = (
  call: ts.CallExpression,
  sourceFile: ts.SourceFile,
  localExternalIds: ReadonlyMap<string, string[]>,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): Map<string, string[]> => {
  const passedExternalParameters = new Map<string, string[]>();
  const calledDeclaration = ts.isIdentifier(call.expression)
    ? findFunctionDeclaration(sourceFile, call.expression.text, sourceFiles)
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

const getExternalIdsCalledByFunction = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  functionName: string,
  visitedFunctions = new Set<string>(),
  inheritedExternalParameters = new Map<string, string[]>(),
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): string[] => {
  if (visitedFunctions.has(functionName)) return [];
  visitedFunctions.add(functionName);

  let parameters: readonly ts.ParameterDeclaration[] | undefined;
  let body: ts.Node | undefined;

  const findFunction = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName && node.body) {
      parameters = node.parameters;
      body = node.body;
      return;
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === functionName &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      parameters = node.initializer.parameters;
      body = node.initializer.body;
      return;
    }

    ts.forEachChild(node, findFunction);
  };

  for (const candidate of sourceFiles) {
    findFunction(candidate);
    if (parameters && body) break;
  }
  if (!parameters || !body) return [];

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

        const externalTypeNames = getExternalTypeNames(
          member.type,
          graph,
          sourceFile,
          new Set(),
          sourceFiles,
        );

        if (externalTypeNames.length === 0) {
          continue;
        }

        externalParameters.set(`${parameter.name.text}.${member.name.text}`, externalTypeNames);
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
      const declaration = findFunctionDeclaration(
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

const addExternalRelationships = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  handlerId: string,
  configuration: ts.ObjectLiteralExpression,
  collectRelationships: boolean,
  sourceFiles: readonly ts.SourceFile[] = [sourceFile],
): void => {
  if (!collectRelationships) return;

  const effectProperty = configuration.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "effect",
  );

  if (!effectProperty) return;

  const localExternalIds = new Map<string, string[]>();
  const visitEffect = (effectNode: ts.Node): void => {
    if (
      ts.isVariableDeclaration(effectNode) &&
      ts.isIdentifier(effectNode.name) &&
      effectNode.initializer &&
      ts.isCallExpression(effectNode.initializer) &&
      ts.isIdentifier(effectNode.initializer.expression)
    ) {
      const declaration = findFunctionDeclaration(
        sourceFile,
        effectNode.initializer.expression.text,
        sourceFiles,
      );
      if (declaration) {
        localExternalIds.set(
          effectNode.name.text,
          getExternalIdsReturnedByFunction(declaration, graph, sourceFile, new Set(), sourceFiles),
        );
      }
    }

    if (ts.isCallExpression(effectNode) && ts.isPropertyAccessExpression(effectNode.expression)) {
      const externalId = getExternalReference(sourceFile, graph, effectNode.expression.expression);
      if (externalId) {
        graph.addEdge({
          source: handlerId,
          target: externalId,
          kind: "CALLS_EXTERNAL",
        });
      }
    } else if (ts.isCallExpression(effectNode) && ts.isIdentifier(effectNode.expression)) {
      const passedExternalParameters = getExternalParametersPassedToFunction(
        effectNode,
        sourceFile,
        localExternalIds,
        sourceFiles,
      );

      for (const externalId of getExternalIdsCalledByFunction(
        sourceFile,
        graph,
        effectNode.expression.text,
        new Set(),
        passedExternalParameters,
        sourceFiles,
      )) {
        graph.addEdge({
          source: handlerId,
          target: externalId,
          kind: "CALLS_EXTERNAL",
        });
      }
    }

    ts.forEachChild(effectNode, visitEffect);
  };

  visitEffect(effectProperty.initializer);
};

const getStoreStateIds = (
  project: TypeScriptProject,
  bindingsByFile: ReadonlyMap<string, SymbolBindings>,
): Map<string, string> => {
  const stateIds = new Map<string, string>();

  for (const { file, source } of project.files) {
    const sourceFile = createTypeScriptSourceFile("flowatlas-store.ts", source);
    const bindings = bindingsByFile.get(file) ?? new Map();
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "configureStore" &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        const reducerProperty = node.arguments[0].properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "reducer",
        );

        if (reducerProperty && ts.isObjectLiteralExpression(reducerProperty.initializer)) {
          for (const property of reducerProperty.initializer.properties) {
            let storeName: string | undefined;
            let reducerName: string | undefined;

            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              ts.isIdentifier(property.initializer)
            ) {
              storeName = property.name.text;
              reducerName = property.initializer.text;
            } else if (ts.isShorthandPropertyAssignment(property)) {
              storeName = property.name.text;
              reducerName = property.name.text;
            }

            if (storeName && reducerName) {
              stateIds.set(bindings.get(reducerName) ?? reducerName, storeName);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return stateIds;
};

const scanSourceIntoGraph = (
  { file, source }: TypeScriptSource,
  graph: ArchitectureGraph,
  bindings: SymbolBindings = new Map(),
  eventIds: EventIds = new Map(),
  stateIds: StateIds = new Map(),
  collectRelationships = true,
  sourceFiles: readonly ts.SourceFile[] = [
    createTypeScriptSourceFile("flowatlas-input.ts", source),
  ],
): void => {
  const sourceFile = createTypeScriptSourceFile("flowatlas-input.ts", source);

  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);

    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith("Gateway")) {
      graph.addNode({ id: node.name.text, kind: "External" });
    }

    let architecturalFunctionId: string | undefined;
    let architecturalFunctionBody: ts.Block | undefined;

    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      architecturalFunctionId = node.name.text;
      architecturalFunctionBody = node.body;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer) &&
      ts.isBlock(node.initializer.body)
    ) {
      architecturalFunctionId = node.name.text;
      architecturalFunctionBody = node.initializer.body;
    }

    if (architecturalFunctionId && architecturalFunctionBody) {
      const listenerAliases = new Set<string>();
      const registrations: ts.CallExpression[] = [];

      const inspectFunction = (functionNode: ts.Node): void => {
        if (
          ts.isVariableDeclaration(functionNode) &&
          ts.isIdentifier(functionNode.name) &&
          functionNode.initializer &&
          ts.isAsExpression(functionNode.initializer) &&
          ts.isPropertyAccessExpression(functionNode.initializer.expression) &&
          functionNode.initializer.expression.name.text === "startListening"
        ) {
          listenerAliases.add(functionNode.name.text);
        }

        if (
          ts.isCallExpression(functionNode) &&
          ts.isIdentifier(functionNode.expression) &&
          listenerAliases.has(functionNode.expression.text) &&
          functionNode.arguments[0] &&
          ts.isObjectLiteralExpression(functionNode.arguments[0])
        ) {
          registrations.push(functionNode);
        }

        ts.forEachChild(functionNode, inspectFunction);
      };

      inspectFunction(architecturalFunctionBody);

      for (const registration of registrations) {
        const configuration = registration.arguments[0];
        if (!configuration || !ts.isObjectLiteralExpression(configuration)) continue;

        addListeningRelationship(
          graph,
          architecturalFunctionId,
          configuration,
          bindings,
          collectRelationships,
        );
        addDispatchRelationships(
          graph,
          architecturalFunctionId,
          configuration,
          bindings,
          collectRelationships,
        );
        addExternalRelationships(
          sourceFile,
          graph,
          architecturalFunctionId,
          configuration,
          collectRelationships,
          sourceFiles,
        );
      }
    }

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createAction"
    ) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const sourceLocation: SourceLocation = { file, line };

      graph.addNode({
        id: eventIds.get(`${file.replaceAll("\\", "/")}#${variableCall.id}`) ?? variableCall.id,
        kind: "Event",
        sourceLocation,
      });
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
        addListeningRelationship(graph, handlerId, configuration, bindings, collectRelationships);
        addDispatchRelationships(graph, handlerId, configuration, bindings, collectRelationships);
        addExternalRelationships(
          sourceFile,
          graph,
          handlerId,
          configuration,
          collectRelationships,
          sourceFiles,
        );
      }
    }

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      (variableCall.call.expression.text === "createSlice" ||
        variableCall.call.expression.text === "createReducer")
    ) {
      const stateId = stateIds.get(variableCall.id) ?? variableCall.id;
      graph.addNode({ id: stateId, kind: "State" });

      const configuration = variableCall.call.arguments[0];
      let reducerBuilder: ts.Node | undefined;

      if (
        ts.isIdentifier(variableCall.call.expression) &&
        variableCall.call.expression.text === "createReducer"
      ) {
        reducerBuilder = variableCall.call.arguments[1];
      } else if (configuration && ts.isObjectLiteralExpression(configuration)) {
        const extraReducersProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "extraReducers",
        );
        reducerBuilder = extraReducersProperty?.initializer;
      }

      if (reducerBuilder && collectRelationships) {
        const visitReducerBuilder = (reducerNode: ts.Node): void => {
          if (
            ts.isCallExpression(reducerNode) &&
            ts.isPropertyAccessExpression(reducerNode.expression) &&
            reducerNode.expression.name.text === "addCase"
          ) {
            const handledEvent = reducerNode.arguments[0];
            if (handledEvent && ts.isIdentifier(handledEvent)) {
              const source = getResolvedEventId(graph, handledEvent.text, bindings);
              if (!source) {
                return;
              }

              graph.addEdge({
                source,
                target: stateId,
                kind: "UPDATES",
              });
            }
          }

          ts.forEachChild(reducerNode, visitReducerBuilder);
        };

        visitReducerBuilder(reducerBuilder);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};

export const scanTypeScriptSource = (input: TypeScriptSource): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  scanSourceIntoGraph(input, graph);
  return graph;
};

export const scanTypeScriptProject = (project: TypeScriptProject): ArchitectureGraph => {
  const graph = createArchitectureGraph();
  const resolution = resolveProjectSymbols(project);
  const stateIds = getStoreStateIds(project, resolution.bindingsByFile);
  const sourceFiles = project.files.map(({ file, source }) =>
    createTypeScriptSourceFile(file, source),
  );

  for (const collectRelationships of [false, true]) {
    for (const file of project.files) {
      scanSourceIntoGraph(
        file,
        graph,
        resolution.bindingsByFile.get(file.file) ?? new Map(),
        resolution.eventIds,
        stateIds,
        collectRelationships,
        sourceFiles,
      );
    }
  }

  return graph;
};
