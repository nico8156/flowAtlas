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

export type VerifiedSnapshotPhase = "canonicalization" | "fingerprint" | "scan";

type VerifiedSnapshotGraphLoaderOptions = {
  onPhase?: (measurement: { phase: VerifiedSnapshotPhase; durationMs: number }) => void;
};

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
  options: VerifiedSnapshotGraphLoaderOptions = {},
): ((projectPath: string) => Promise<ArchitectureGraph>) => {
  let snapshot: VerifiedGraphSnapshot | undefined;

  return async (projectPath) => {
    let startedAt = performance.now();
    const projectRoot = await canonicalizeProjectRoot(projectPath);
    options.onPhase?.({
      phase: "canonicalization",
      durationMs: performance.now() - startedAt,
    });
    const loadedProject = await loadProject(projectRoot);
    startedAt = performance.now();
    const fingerprint = fingerprintProject(loadedProject.project);
    options.onPhase?.({ phase: "fingerprint", durationMs: performance.now() - startedAt });

    if (snapshot?.projectRoot === projectRoot && snapshot.fingerprint === fingerprint) {
      return snapshot.graph;
    }

    startedAt = performance.now();
    const graph = scanProject(loadedProject.project);
    options.onPhase?.({ phase: "scan", durationMs: performance.now() - startedAt });
    snapshot = { projectRoot, fingerprint, graph };
    return graph;
  };
};
