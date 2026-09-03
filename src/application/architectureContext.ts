import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import {
  projectDownstream,
  projectUpstream,
  type GraphProjection,
} from "../domain/graphProjection.js";
import { projectFocusedTerritory } from "./focusedGraphProjection.js";

export type ArchitectureContextDirection = "upstream" | "downstream" | "both";

export type ArchitectureContext = {
  readonly schemaVersion: 1;
  readonly focus: NonNullable<ReturnType<ArchitectureGraph["findNode"]>>;
  readonly request: {
    readonly direction: ArchitectureContextDirection;
    readonly maxDepth: number;
  };
  readonly projection: GraphProjection;
};

export const buildArchitectureContext = (
  graph: ArchitectureGraph,
  nodeId: string,
  direction: ArchitectureContextDirection,
  maxDepth: number,
): ArchitectureContext => {
  const focus = graph.findNode(nodeId);
  if (!focus) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const projection =
    direction === "downstream"
      ? projectDownstream(graph, nodeId, { maxDepth })
      : direction === "upstream"
        ? projectUpstream(graph, nodeId, { maxDepth })
        : projectFocusedTerritory(graph, nodeId, maxDepth);

  return {
    schemaVersion: 1,
    focus,
    request: { direction, maxDepth },
    projection,
  };
};

export const serializeArchitectureContext = (context: ArchitectureContext): string =>
  JSON.stringify(context, null, 2);
