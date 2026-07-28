import { formatArchitectureSummary } from "./application/architectureSummary.js";
import { formatNodeInspection } from "./application/nodeInspection.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const usage = "Usage: flowatlas scan [path] | flowatlas inspect <nodeId> [path]";

export const runCli = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
  const [command = "scan", firstArgument, secondArgument, ...unexpectedArguments] = arguments_;

  const nodeId = command === "inspect" ? firstArgument : undefined;
  const projectPath = command === "inspect" ? (secondArgument ?? ".") : (firstArgument ?? ".");

  if (
    (command !== "scan" && command !== "inspect") ||
    (command === "inspect" && !nodeId) ||
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

  const output = formatArchitectureSummary(
    loadedProject.name,
    loadedProject.project.files.length,
    graph,
  );

  process.stdout.write(`${output}\n`);
};
