import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";
import { type SymbolBindings, type TypeScriptProject } from "./projectSymbolResolver.js";
import { createTypeScriptSourceFile, getVariableCall } from "./typeScriptAst.js";

export type StateIds = ReadonlyMap<string, string>;

const getIsAnyOfMatchers = (sourceFile: ts.SourceFile): ReadonlyMap<string, readonly string[]> => {
  const matchers = new Map<string, readonly string[]>();
  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);
    if (
      variableCall &&
      ts.isIdentifier(variableCall.call.expression) &&
      variableCall.call.expression.text === "isAnyOf"
    ) {
      matchers.set(
        variableCall.id,
        variableCall.call.arguments
          .filter((argument): argument is ts.Identifier => ts.isIdentifier(argument))
          .map((argument) => argument.text),
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return matchers;
};

export const getStoreStateIds = (
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

export const detectStates = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  stateIds: StateIds,
  getResolvedEventId: (localName: string) => string | undefined,
  collectRelationships: boolean,
): void => {
  const isAnyOfMatchers = getIsAnyOfMatchers(sourceFile);
  const visit = (node: ts.Node): void => {
    const variableCall = getVariableCall(node);
    if (
      !variableCall ||
      !ts.isIdentifier(variableCall.call.expression) ||
      (variableCall.call.expression.text !== "createSlice" &&
        variableCall.call.expression.text !== "createReducer")
    ) {
      ts.forEachChild(node, visit);
      return;
    }

    const stateId = stateIds.get(variableCall.id) ?? variableCall.id;
    graph.addNode({ id: stateId, kind: "State" });

    const configuration = variableCall.call.arguments[0];
    let reducerBuilder: ts.Node | undefined;
    if (variableCall.call.expression.text === "createReducer") {
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
          ts.isPropertyAccessExpression(reducerNode.expression)
        ) {
          const handledEvent = reducerNode.arguments[0];
          const handledEventNames =
            reducerNode.expression.name.text === "addCase" &&
            handledEvent &&
            ts.isIdentifier(handledEvent)
              ? [handledEvent.text]
              : reducerNode.expression.name.text === "addMatcher" &&
                  handledEvent &&
                  ts.isIdentifier(handledEvent)
                ? (isAnyOfMatchers.get(handledEvent.text) ?? [])
                : [];

          for (const handledEventName of handledEventNames) {
            const source = getResolvedEventId(handledEventName);
            if (source) {
              graph.addEdge({ source, target: stateId, kind: "UPDATES" });
            }
          }
        }

        ts.forEachChild(reducerNode, visitReducerBuilder);
      };

      visitReducerBuilder(reducerBuilder);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};
