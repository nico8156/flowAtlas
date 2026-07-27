import * as ts from "typescript";

import { type ArchitectureGraph } from "../domain/architectureGraph.js";
import {
  getExternalIdsCalledByFunction,
  getExternalIdsReturnedByFunction,
  getExternalParametersPassedToFunction,
  getExternalReference,
} from "./externalResolution.js";
import { findFunctionLike } from "./functionResolver.js";
import { getResolvedEventId } from "./eventDetector.js";

type ListenerContext = {
  sourceFile: ts.SourceFile;
  graph: ArchitectureGraph;
  bindings: ReadonlyMap<string, string>;
  collectRelationships: boolean;
  sourceFiles: readonly ts.SourceFile[];
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

const addDispatchRelationships = (
  graph: ArchitectureGraph,
  handlerId: string,
  configuration: ts.ObjectLiteralExpression,
  bindings: ReadonlyMap<string, string>,
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
        if (target) {
          graph.addEdge({ source: handlerId, target, kind: "DISPATCHES" });
        }
      }
    }

    ts.forEachChild(effectNode, visitEffect);
  };

  visitEffect(effectProperty.initializer);
};

const addExternalRelationships = ({
  sourceFile,
  graph,
  handlerId,
  configuration,
  collectRelationships,
  sourceFiles,
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
        graph.addEdge({ source: handlerId, target: externalId, kind: "CALLS_EXTERNAL" });
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
        addExternalRelationships({
          sourceFile,
          graph,
          bindings,
          collectRelationships,
          sourceFiles,
          handlerId: architecturalFunctionId,
          configuration,
        });
      }
    }

    if (
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
          handlerId,
          configuration,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
};
