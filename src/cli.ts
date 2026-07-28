import { render } from "ink";
import { createElement } from "react";

import { formatArchitectureSummary } from "./application/architectureSummary.js";
import { serializeArchitectureGraph } from "./application/architectureGraphJson.js";
import { formatGraphProjection } from "./application/graphProjectionOutput.js";
import { projectFocusedTerritory } from "./application/focusedGraphProjection.js";
import { formatNodeInspection } from "./application/nodeInspection.js";
import { formatTerminalMap } from "./application/terminalMapOutput.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { projectDownstream, projectUpstream } from "./domain/graphProjection.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";
import { TerminalTui } from "./tui/TerminalTui.js";

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

    const projection = projectFocusedTerritory(graph, nodeId);
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      process.stdout.write(`${formatTerminalMap(nodeId, projection, false)}\n`);
      return;
    }

    const instance = render(
      createElement(TerminalTui, {
        initialSelectedNodeId: nodeId,
        projection,
      }),
    );
    await instance.waitUntilExit();
    return;
  }

  const output = formatArchitectureSummary(
    loadedProject.name,
    loadedProject.project.files.length,
    graph,
  );

  process.stdout.write(`${output}\n`);
};
