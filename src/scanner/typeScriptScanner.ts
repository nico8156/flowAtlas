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

const scanSourceIntoGraph = (
  { file, source }: TypeScriptSource,
  graph: ArchitectureGraph,
  bindings: SymbolBindings = new Map(),
  eventIds: EventIds = new Map(),
): void => {
  const sourceFile = createTypeScriptSourceFile("flowatlas-input.ts", source);

  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);

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
        const actionCreatorProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "actionCreator",
        );

        if (actionCreatorProperty && ts.isIdentifier(actionCreatorProperty.initializer)) {
          graph.addEdge({
            source: handlerId,
            target:
              bindings.get(actionCreatorProperty.initializer.text) ??
              actionCreatorProperty.initializer.text,
            kind: "LISTENS_TO",
          });
        }

        const effectProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "effect",
        );

        if (effectProperty) {
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
                graph.addEdge({
                  source: handlerId,
                  target:
                    bindings.get(dispatchedAction.expression.text) ??
                    dispatchedAction.expression.text,
                  kind: "DISPATCHES",
                });
              }
            }

            ts.forEachChild(effectNode, visitEffect);
          };

          visitEffect(effectProperty.initializer);
        }
      }
    }

    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "createSlice"
    ) {
      const stateId = variableCall.id;
      graph.addNode({ id: stateId, kind: "State" });

      const configuration = variableCall.call.arguments[0];
      if (configuration && ts.isObjectLiteralExpression(configuration)) {
        const extraReducersProperty = configuration.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === "extraReducers",
        );

        if (extraReducersProperty) {
          const visitExtraReducers = (reducerNode: ts.Node): void => {
            if (
              ts.isCallExpression(reducerNode) &&
              ts.isPropertyAccessExpression(reducerNode.expression) &&
              reducerNode.expression.name.text === "addCase"
            ) {
              const handledEvent = reducerNode.arguments[0];
              if (handledEvent && ts.isIdentifier(handledEvent)) {
                graph.addEdge({
                  source: bindings.get(handledEvent.text) ?? handledEvent.text,
                  target: stateId,
                  kind: "UPDATES",
                });
              }
            }

            ts.forEachChild(reducerNode, visitExtraReducers);
          };

          visitExtraReducers(extraReducersProperty.initializer);
        }
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

  for (const file of project.files) {
    scanSourceIntoGraph(
      file,
      graph,
      resolution.bindingsByFile.get(file.file) ?? new Map(),
      resolution.eventIds,
    );
  }

  return graph;
};
