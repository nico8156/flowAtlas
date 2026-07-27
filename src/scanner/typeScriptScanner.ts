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
): void => {
  const sourceFile = createTypeScriptSourceFile("flowatlas-input.ts", source);

  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);

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

  for (const collectRelationships of [false, true]) {
    for (const file of project.files) {
      scanSourceIntoGraph(
        file,
        graph,
        resolution.bindingsByFile.get(file.file) ?? new Map(),
        resolution.eventIds,
        stateIds,
        collectRelationships,
      );
    }
  }

  return graph;
};
