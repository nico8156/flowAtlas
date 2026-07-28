import { formatArchitectureSummary } from "./application/architectureSummary.js";
import { loadTypeScriptProject } from "./cli/projectLoader.js";
import { scanTypeScriptProject } from "./scanner/typeScriptScanner.js";

const usage = "Usage: flowatlas scan [path]";

export const runCli = async (
  arguments_: readonly string[] = process.argv.slice(2),
): Promise<void> => {
  const [command = "scan", projectPath = ".", ...unexpectedArguments] = arguments_;

  if (command !== "scan" || unexpectedArguments.length > 0) {
    throw new Error(usage);
  }

  const loadedProject = await loadTypeScriptProject(projectPath);
  const graph = scanTypeScriptProject(loadedProject.project);
  const output = formatArchitectureSummary(
    loadedProject.name,
    loadedProject.project.files.length,
    graph,
  );

  process.stdout.write(`${output}\n`);
};
