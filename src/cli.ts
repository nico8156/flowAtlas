import { render } from "ink";
import { createElement } from "react";

import { formatArchitectureSummary } from "./application/architectureSummary.js";
import { serializeArchitectureGraph } from "./application/architectureGraphJson.js";
import { formatGraphProjection } from "./application/graphProjectionOutput.js";
import { projectFocusedTerritory } from "./application/focusedGraphProjection.js";
import { formatNodeInspection } from "./application/nodeInspection.js";
import { formatTerminalMap } from "./application/terminalMapOutput.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { startScanProjectInWorker } from "./cli/scanInWorker.js";
import { projectDownstream, projectUpstream } from "./domain/graphProjection.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";
import {
  TerminalTuiLoader,
  type ProjectionChange,
  type TerminalTuiLoadResult,
} from "./tui/TerminalTui.js";

const usage =
  "Usage: flowatlas scan [path] | flowatlas inspect <nodeId> [path] | flowatlas downstream <nodeId> [path] | flowatlas upstream <nodeId> [path] | flowatlas focus <nodeId> [path] | flowatlas tui <nodeId> [path]";

export const runCli = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
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
              projectionChange("focus", (id) => projectFocusedTerritory(graph, id), selectedNodeId),
            projectDownstream: (selectedNodeId) =>
              projectionChange("downstream", (id) => projectDownstream(graph, id), selectedNodeId),
            projectUpstream: (selectedNodeId) =>
              projectionChange("upstream", (id) => projectUpstream(graph, id), selectedNodeId),
          };
        },
        cancel: () => activeScanCancel(),
      }),
    );
    await instance.waitUntilExit();
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
