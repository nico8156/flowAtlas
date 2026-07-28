import { formatArchitectureSummary } from "./application/architectureSummary.js";
import { formatGraphProjection } from "./application/graphProjectionOutput.js";
import { formatNodeInspection } from "./application/nodeInspection.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { projectDownstream, projectUpstream } from "./domain/graphProjection.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const usage =
  "Usage: flowatlas scan [path] | flowatlas inspect <nodeId> [path] | flowatlas downstream <nodeId> [path] | flowatlas upstream <nodeId> [path]";

export const runCli = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
  const [command = "scan", firstArgument, secondArgument, ...unexpectedArguments] = arguments_;

  const nodeId = command === "scan" ? undefined : firstArgument;
  const projectPath = command === "scan" ? (firstArgument ?? ".") : (secondArgument ?? ".");

  if (
    !["scan", "inspect", "downstream", "upstream"].includes(command) ||
    (command !== "scan" && !nodeId) ||
    unexpectedArguments.length > 0
  ) {
    throw new Error(usage);
  }

  const loadedProject = await loadTypeScriptProject(projectPath);
  const graph = scanTypeScriptProject(loadedProject.project);

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

  const output = formatArchitectureSummary(
    loadedProject.name,
    loadedProject.project.files.length,
    graph,
  );

  process.stdout.write(`${output}\n`);
};
