import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";
import {
  getExternalIdsCalledByFunction,
  getExternalIdsCalledByFunctionLike,
  getExternalIdsReturnedByFunction,
  getExternalParametersPassedToFunction,
  getExternalReference,
} from "./externalResolution.js";
import { findFunctionLike, findReturnedFunctionLike } from "./functionResolver.js";
import { getResolvedEventId } from "./eventDetector.js";
import { getExternalProtocolEventId } from "./externalProtocolEvent.js";
import { type SemanticIndex } from "./semanticIndex.js";

type ListenerContext = {
  sourceFile: ts.SourceFile;
  graph: ArchitectureGraph;
  bindings: ReadonlyMap<string, string>;
  collectRelationships: boolean;
  sourceFiles: readonly ts.SourceFile[];
  semanticIndex?: SemanticIndex | undefined;
};

const isNestedFunctionLike = (node: ts.Node): boolean => {
  let parent = node.parent;
  while (parent) {
    if (
      ts.isFunctionDeclaration(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isFunctionExpression(parent)
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
};

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
  bindings: ReadonlyMap<string, string>,
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

const addDispatchRelationshipsFromBody = (
  graph: ArchitectureGraph,
  handlerId: string,
  body: ts.Node,
  bindings: ReadonlyMap<string, string>,
  collectRelationships: boolean,
): void => {
  if (!collectRelationships) return;

  const visitBody = (bodyNode: ts.Node): void => {
    if (
      ts.isCallExpression(bodyNode) &&
      ((ts.isPropertyAccessExpression(bodyNode.expression) &&
        bodyNode.expression.name.text === "dispatch") ||
        (ts.isIdentifier(bodyNode.expression) && bodyNode.expression.text === "dispatch"))
    ) {
      const dispatchedAction = bodyNode.arguments[0];
      if (
        dispatchedAction &&
        ts.isCallExpression(dispatchedAction) &&
        ts.isIdentifier(dispatchedAction.expression)
      ) {
        const target = getResolvedEventId(graph, dispatchedAction.expression.text, bindings);
        if (target) {
          graph.addEdge({ source: handlerId, target, kind: "DISPATCHES" });
        }
      }
    }

    ts.forEachChild(bodyNode, visitBody);
  };

  visitBody(body);
};

const addDispatchRelationships = (
  graph: ArchitectureGraph,
  handlerId: string,
  configuration: ts.ObjectLiteralExpression,
  bindings: ReadonlyMap<string, string>,
  collectRelationships: boolean,
): void => {
  const effectProperty = configuration.properties.find(
    (property): property is ts.PropertyAssignment =>
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === "effect",
  );
  if (!effectProperty) return;

  addDispatchRelationshipsFromBody(
    graph,
    handlerId,
    effectProperty.initializer,
    bindings,
    collectRelationships,
  );
};

const addInfrastructureListeningRelationship = (
  sourceFile: ts.SourceFile,
  graph: ArchitectureGraph,
  handlerId: string,
  callback: ts.Expression,
  bindings: ReadonlyMap<string, string>,
  collectRelationships: boolean,
  sourceFiles: readonly ts.SourceFile[],
  semanticIndex?: SemanticIndex,
): void => {
  graph.addNode({ id: handlerId, kind: "Handler" });
  if (!collectRelationships) return;

  const visitedFunctions = new Set<string>();
  const visitCallback = (node: ts.Node): void => {
    const externalProtocolEventId = getExternalProtocolEventId(node);
    if (externalProtocolEventId) {
      const target = getResolvedEventId(graph, externalProtocolEventId, bindings);
      if (target) {
        graph.addEdge({ source: handlerId, target, kind: "LISTENS_TO" });
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const functionName = node.expression.text;
      if (!visitedFunctions.has(functionName)) {
        const declaration = findFunctionLike(sourceFile, functionName, sourceFiles, semanticIndex);
        if (declaration) {
          visitedFunctions.add(functionName);
          visitCallback(declaration.body);
        }
      }
    }

    ts.forEachChild(node, visitCallback);
  };

  visitCallback(callback);
};

const addExternalRelationships = ({
  sourceFile,
  graph,
  handlerId,
  configuration,
  collectRelationships,
  sourceFiles,
  semanticIndex,
}: ListenerContext & {
  handlerId: string;
  configuration: ts.ObjectLiteralExpression;
}): void => {
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
      const declaration = findFunctionLike(
        sourceFile,
        effectNode.initializer.expression.text,
        sourceFiles,
        semanticIndex,
      );
      if (declaration) {
        localExternalIds.set(
          effectNode.name.text,
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
    }

    if (ts.isCallExpression(effectNode) && ts.isPropertyAccessExpression(effectNode.expression)) {
      const externalId = getExternalReference(
        sourceFile,
        graph,
        effectNode.expression.expression,
        semanticIndex,
      );
      if (externalId) {
        graph.addEdge({ source: handlerId, target: externalId, kind: "CALLS_EXTERNAL" });
      }
    } else if (ts.isCallExpression(effectNode) && ts.isIdentifier(effectNode.expression)) {
      const passedExternalParameters = getExternalParametersPassedToFunction(
        effectNode,
        sourceFile,
        localExternalIds,
        sourceFiles,
        semanticIndex,
      );
      for (const externalId of getExternalIdsCalledByFunction(
        sourceFile,
        graph,
        effectNode.expression.text,
        new Set(),
        passedExternalParameters,
        sourceFiles,
        semanticIndex,
      )) {
        graph.addEdge({ source: handlerId, target: externalId, kind: "CALLS_EXTERNAL" });
      }
    }

    ts.forEachChild(effectNode, visitEffect);
  };

  visitEffect(effectProperty.initializer);
};

export const detectListeners = ({
  sourceFile,
  graph,
  bindings,
  collectRelationships,
  sourceFiles,
  semanticIndex,
}: ListenerContext): void => {
  const visit = (node: ts.Node): void => {
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

    if (!isNestedFunctionLike(node) && architecturalFunctionId && architecturalFunctionBody) {
      const listenerAliases = new Set<string>();
      const registrations: ts.CallExpression[] = [];
      const infrastructureCallbacks: ts.Expression[] = [];
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
        if (
          ts.isCallExpression(functionNode) &&
          ts.isPropertyAccessExpression(functionNode.expression) &&
          functionNode.expression.name.text === "connect" &&
          functionNode.arguments[0] &&
          ts.isObjectLiteralExpression(functionNode.arguments[0])
        ) {
          const onEvent = functionNode.arguments[0].properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "onEvent",
          );
          if (
            onEvent &&
            (ts.isArrowFunction(onEvent.initializer) ||
              ts.isFunctionExpression(onEvent.initializer))
          ) {
            infrastructureCallbacks.push(onEvent.initializer);
          }
        }
        ts.forEachChild(functionNode, inspectFunction);
      };
      inspectFunction(architecturalFunctionBody);

      for (const callback of infrastructureCallbacks) {
        addInfrastructureListeningRelationship(
          sourceFile,
          graph,
          architecturalFunctionId,
          callback,
          bindings,
          collectRelationships,
          sourceFiles,
          semanticIndex,
        );
      }

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
        addExternalRelationships({
          sourceFile,
          graph,
          bindings,
          collectRelationships,
          sourceFiles,
          semanticIndex,
          handlerId: architecturalFunctionId,
          configuration,
        });
      }
    }

    if (
      !isNestedFunctionLike(node) &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === "startListening"
    ) {
      const handlerId = node.name.text;
      graph.addNode({ id: handlerId, kind: "Handler" });
      const configuration = node.initializer.arguments[0];
      if (configuration && ts.isObjectLiteralExpression(configuration)) {
        addListeningRelationship(graph, handlerId, configuration, bindings, collectRelationships);
        addDispatchRelationships(graph, handlerId, configuration, bindings, collectRelationships);
        addExternalRelationships({
          sourceFile,
          graph,
          bindings,
          collectRelationships,
          sourceFiles,
          semanticIndex,
          handlerId,
          configuration,
        });
      }
    }

    if (
      !isNestedFunctionLike(node) &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isArrowFunction(node.initializer) &&
      (ts.isArrowFunction(node.initializer.body) || ts.isFunctionExpression(node.initializer.body))
    ) {
      graph.addNode({ id: node.name.text, kind: "Handler" });
      if (collectRelationships) {
        const returnedFunction = findReturnedFunctionLike(
          sourceFile,
          node.name.text,
          sourceFiles,
          semanticIndex,
        );
        if (returnedFunction) {
          addDispatchRelationshipsFromBody(
            graph,
            node.name.text,
            returnedFunction.body,
            bindings,
            collectRelationships,
          );
          for (const externalId of getExternalIdsCalledByFunctionLike(
            sourceFile,
            graph,
            node.name.text,
            returnedFunction,
            new Set(),
            new Map(),
            sourceFiles,
            semanticIndex,
          )) {
            graph.addEdge({ source: node.name.text, target: externalId, kind: "CALLS_EXTERNAL" });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};
