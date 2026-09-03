import { render } from "ink";
import { createElement } from "react";

import { formatArchitectureSummary } from "./application/architectureSummary.js";
import {
  buildArchitectureContext,
  serializeArchitectureContext,
  type ArchitectureContextDirection,
} from "./application/architectureContext.js";
import { serializeArchitectureGraph } from "./application/architectureGraphJson.js";
import {
  findArchitectureNodes,
  serializeArchitectureNodeDiscovery,
} from "./application/architectureNodeDiscovery.js";
import { formatGraphProjection } from "./application/graphProjectionOutput.js";
import { projectFocusedTerritory } from "./application/focusedGraphProjection.js";
import { formatNodeInspection } from "./application/nodeInspection.js";
import { formatTerminalMap } from "./application/terminalMapOutput.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { startScanProjectInWorker } from "./cli/scanInWorker.js";
import { runInAlternateTerminalScreen } from "./cli/terminalSession.js";
import { projectDownstream, projectUpstream } from "./domain/graphProjection.js";
import type { NodeKind } from "./domain/architectureGraph.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";
import {
  TerminalTuiLoader,
  type ProjectionChange,
  type TerminalTuiLoadResult,
} from "./tui/TerminalTui.js";

const usage =
  "Usage: flowatlas scan [path] | flowatlas inspect <nodeId> [path] | flowatlas downstream <nodeId> [path] | flowatlas upstream <nodeId> [path] | flowatlas focus <nodeId> [path] | flowatlas find <query> [path] --kind <Event|Handler|State|External> --limit <count> --json | flowatlas context <nodeId> [path] --direction <upstream|downstream|both> --depth <count> [--max-nodes <count> --max-edges <count>] --json | flowatlas tui <nodeId> [path]";

const nodeKinds: readonly NodeKind[] = ["Event", "Handler", "State", "External"];

const parseFindArguments = (
  arguments_: readonly string[],
): { query: string; projectPath: string; kind: NodeKind; limit: number } => {
  const [query, possiblePath, ...remainingArguments] = arguments_;
  if (!query || !query.trim()) throw new Error(usage);

  const hasProjectPath = possiblePath !== undefined && !possiblePath.startsWith("--");
  const projectPath = hasProjectPath ? possiblePath : ".";
  const options = hasProjectPath
    ? remainingArguments
    : possiblePath === undefined
      ? remainingArguments
      : [possiblePath, ...remainingArguments];
  let kind: NodeKind | undefined;
  let limit: number | undefined;
  let json = false;

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === "--json") {
      json = true;
      continue;
    }
    if (option === "--kind") {
      const value = options[index + 1] as NodeKind | undefined;
      if (!value || !nodeKinds.includes(value)) throw new Error(usage);
      kind = value;
      index += 1;
      continue;
    }
    if (option === "--limit") {
      const value = Number(options[index + 1]);
      if (!Number.isInteger(value) || value <= 0) throw new Error(usage);
      limit = value;
      index += 1;
      continue;
    }
    throw new Error(usage);
  }

  if (!json || kind === undefined || limit === undefined) throw new Error(usage);
  return { query, projectPath, kind, limit };
};

const parseContextArguments = (
  arguments_: readonly string[],
): {
  nodeId: string;
  projectPath: string;
  direction: ArchitectureContextDirection;
  maxDepth: number;
  maxNodes?: number;
  maxEdges?: number;
} => {
  const [nodeId, possiblePath, ...remainingArguments] = arguments_;
  if (!nodeId) throw new Error(usage);

  const hasProjectPath = possiblePath !== undefined && !possiblePath.startsWith("--");
  const projectPath = hasProjectPath ? possiblePath : ".";
  const options = hasProjectPath
    ? remainingArguments
    : possiblePath === undefined
      ? remainingArguments
      : [possiblePath, ...remainingArguments];
  let direction: ArchitectureContextDirection | undefined;
  let maxDepth: number | undefined;
  let maxNodes: number | undefined;
  let maxEdges: number | undefined;
  let json = false;

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === "--json") {
      json = true;
      continue;
    }
    if (option === "--direction") {
      const value = options[index + 1];
      if (value !== "upstream" && value !== "downstream" && value !== "both") {
        throw new Error(usage);
      }
      direction = value;
      index += 1;
      continue;
    }
    if (option === "--depth") {
      const value = Number(options[index + 1]);
      if (!Number.isInteger(value) || value < 0) throw new Error(usage);
      maxDepth = value;
      index += 1;
      continue;
    }
    if (option === "--max-nodes") {
      const value = Number(options[index + 1]);
      if (!Number.isInteger(value) || value <= 0) throw new Error(usage);
      maxNodes = value;
      index += 1;
      continue;
    }
    if (option === "--max-edges") {
      const value = Number(options[index + 1]);
      if (!Number.isInteger(value) || value < 0) throw new Error(usage);
      maxEdges = value;
      index += 1;
      continue;
    }
    throw new Error(usage);
  }

  if (
    !json ||
    direction === undefined ||
    maxDepth === undefined ||
    (maxNodes === undefined) !== (maxEdges === undefined)
  ) {
    throw new Error(usage);
  }

  return {
    nodeId,
    projectPath,
    direction,
    maxDepth,
    ...(maxNodes !== undefined && maxEdges !== undefined ? { maxNodes, maxEdges } : {}),
  };
};

export const runCli = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
  if (arguments_[0] === "find") {
    const { query, projectPath, kind, limit } = parseFindArguments(arguments_.slice(1));
    const loadedProject = await loadTypeScriptProject(projectPath);
    const graph = scanTypeScriptProject(loadedProject.project);
    const discovery = findArchitectureNodes(graph, query, [kind], limit);
    process.stdout.write(`${serializeArchitectureNodeDiscovery(discovery)}\n`);
    return;
  }

  if (arguments_[0] === "context") {
    const { nodeId, projectPath, direction, maxDepth, maxNodes, maxEdges } = parseContextArguments(
      arguments_.slice(1),
    );
    const loadedProject = await loadTypeScriptProject(projectPath);
    const graph = scanTypeScriptProject(loadedProject.project);
    const limits =
      maxNodes !== undefined && maxEdges !== undefined ? { maxNodes, maxEdges } : undefined;
    const context = buildArchitectureContext(graph, nodeId, direction, maxDepth, limits);
    process.stdout.write(`${serializeArchitectureContext(context)}\n`);
    return;
  }

  const [command = "scan", firstArgument, secondArgument, ...unexpectedArguments] = arguments_;

  const jsonExport = command === "scan" && firstArgument === "--json";
  const nodeId = command === "scan" ? undefined : firstArgument;
  const projectPath =
    command === "scan"
      ? jsonExport
        ? (secondArgument ?? ".")
        : (firstArgument ?? ".")
      : (secondArgument ?? ".");
  const scanHasUnexpectedArguments =
    command === "scan" &&
    (jsonExport
      ? unexpectedArguments.length > 0
      : secondArgument !== undefined || unexpectedArguments.length > 0);

  if (
    !["scan", "inspect", "downstream", "upstream", "focus", "tui"].includes(command) ||
    (command !== "scan" && !nodeId) ||
    scanHasUnexpectedArguments ||
    (command !== "scan" && unexpectedArguments.length > 0)
  ) {
    throw new Error(usage);
  }

  if (command === "tui" && process.stdin.isTTY && process.stdout.isTTY) {
    if (!nodeId) {
      throw new Error(usage);
    }

    let activeScanCancel = (): void => undefined;
    await runInAlternateTerminalScreen(
      (sequence) => process.stdout.write(sequence),
      async () => {
        const instance = render(
          createElement(TerminalTuiLoader, {
            projectLabel: projectPath,
            load: async (): Promise<TerminalTuiLoadResult> => {
              const task = startScanProjectInWorker(projectPath);
              activeScanCancel = task.cancel;
              const graph = await task.promise;

              if (!graph.findNode(nodeId)) {
                throw new Error(`Node not found: ${nodeId}`);
              }

              const fullProjection = { nodes: graph.nodes, edges: graph.edges };
              const projectionChange = (
                mode: ProjectionChange["mode"],
                createProjection: (selectedNodeId: string) => ProjectionChange["projection"],
                selectedNodeId: string,
              ): ProjectionChange => ({
                mode,
                projection: createProjection(selectedNodeId),
                rootNodeId: selectedNodeId,
              });

              return {
                initialSelectedNodeId: nodeId,
                projection: fullProjection,
                projectFocus: (selectedNodeId) =>
                  projectionChange(
                    "focus",
                    (id) => projectFocusedTerritory(graph, id),
                    selectedNodeId,
                  ),
                projectDownstream: (selectedNodeId) =>
                  projectionChange(
                    "downstream",
                    (id) => projectDownstream(graph, id),
                    selectedNodeId,
                  ),
                projectUpstream: (selectedNodeId) =>
                  projectionChange("upstream", (id) => projectUpstream(graph, id), selectedNodeId),
                projectIncomingHandlers: (selectedNodeId) =>
                  projectionChange(
                    "handlers",
                    (id) => projectUpstream(graph, id, { maxDepth: 1 }),
                    selectedNodeId,
                  ),
              };
            },
            cancel: () => activeScanCancel(),
          }),
        );
        await instance.waitUntilExit();
      },
    );
    return;
  }

  const loadedProject = await loadTypeScriptProject(projectPath);
  const graph = scanTypeScriptProject(loadedProject.project);

  if (jsonExport) {
    process.stdout.write(`${serializeArchitectureGraph(graph)}\n`);
    return;
  }

  if (command === "inspect") {
    if (!nodeId) {
      throw new Error(usage);
    }

    process.stdout.write(`${formatNodeInspection(graph, nodeId)}\n`);
    return;
  }

  if (command === "downstream") {
    if (!nodeId || !graph.findNode(nodeId)) {
      throw new Error(`Node not found: ${nodeId ?? ""}`.trim());
    }

    const projection = projectDownstream(graph, nodeId);
    process.stdout.write(`${formatGraphProjection(nodeId, projection)}\n`);
    return;
  }

  if (command === "upstream") {
    if (!nodeId || !graph.findNode(nodeId)) {
      throw new Error(`Node not found: ${nodeId ?? ""}`.trim());
    }

    const projection = projectUpstream(graph, nodeId);
    process.stdout.write(`${formatGraphProjection(nodeId, projection)}\n`);
    return;
  }

  if (command === "focus") {
    if (!nodeId || !graph.findNode(nodeId)) {
      throw new Error(`Node not found: ${nodeId ?? ""}`.trim());
    }

    const projection = projectFocusedTerritory(graph, nodeId);
    process.stdout.write(`${formatTerminalMap(nodeId, projection, process.stdout.isTTY)}\n`);
    return;
  }

  if (command === "tui") {
    if (!nodeId || !graph.findNode(nodeId)) {
      throw new Error(`Node not found: ${nodeId ?? ""}`.trim());
    }

    const focusedProjection = projectFocusedTerritory(graph, nodeId);
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      process.stdout.write(`${formatTerminalMap(nodeId, focusedProjection, false)}\n`);
      return;
    }

    return;
  }

  const output = formatArchitectureSummary(
    loadedProject.name,
    loadedProject.project.files.length,
    graph,
  );

  process.stdout.write(`${output}\n`);
};
