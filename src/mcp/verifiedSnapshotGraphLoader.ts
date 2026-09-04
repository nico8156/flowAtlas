import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import type { TypeScriptProject, TypeScriptSource } from "../scanner/projectSymbolResolver.js";

type LoadedTypeScriptProject = {
  name: string;
  project: TypeScriptProject;
};

type TypeScriptProjectLoader = (projectPath: string) => Promise<LoadedTypeScriptProject>;
type TypeScriptProjectScanner = (project: TypeScriptProject) => ArchitectureGraph;

type VerifiedGraphSnapshot = {
  projectRoot: string;
  fingerprint: string;
  graph: ArchitectureGraph;
};

const orderedSources = (sources: readonly TypeScriptSource[]): TypeScriptSource[] =>
  [...sources].sort((left, right) => left.file.localeCompare(right.file));

const fingerprintProject = (project: TypeScriptProject): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        files: orderedSources(project.files),
        projectFiles: orderedSources(project.projectFiles ?? project.files),
        tsconfig: project.tsconfig ?? null,
      }),
    )
    .digest("hex");

const canonicalizeProjectRoot = async (projectPath: string): Promise<string> => {
  const resolvedPath = resolve(projectPath);
  try {
    return await realpath(resolvedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolvedPath;
    throw error;
  }
};

export const createVerifiedSnapshotGraphLoader = (
  loadProject: TypeScriptProjectLoader,
  scanProject: TypeScriptProjectScanner,
): ((projectPath: string) => Promise<ArchitectureGraph>) => {
  let snapshot: VerifiedGraphSnapshot | undefined;

  return async (projectPath) => {
    const projectRoot = await canonicalizeProjectRoot(projectPath);
    const loadedProject = await loadProject(projectRoot);
    const fingerprint = fingerprintProject(loadedProject.project);

    if (snapshot?.projectRoot === projectRoot && snapshot.fingerprint === fingerprint) {
      return snapshot.graph;
    }

    const graph = scanProject(loadedProject.project);
    snapshot = { projectRoot, fingerprint, graph };
    return graph;
  };
};
