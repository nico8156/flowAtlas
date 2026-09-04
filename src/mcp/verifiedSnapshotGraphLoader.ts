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
  maxSnapshots?: number;
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
  const maxSnapshots = options.maxSnapshots ?? 1;
  if (!Number.isInteger(maxSnapshots) || maxSnapshots < 1) {
    throw new Error("Verified snapshot capacity must be a positive integer.");
  }
  const snapshotsByProjectRoot = new Map<string, VerifiedGraphSnapshot>();
  const inFlightByProjectRoot = new Map<string, Promise<ArchitectureGraph>>();

  return async (projectPath) => {
    const startedAt = performance.now();
    const projectRoot = await canonicalizeProjectRoot(projectPath);
    options.onPhase?.({
      phase: "canonicalization",
      durationMs: performance.now() - startedAt,
    });
    const existingRequest = inFlightByProjectRoot.get(projectRoot);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const loadedProject = await loadProject(projectRoot);
      let phaseStartedAt = performance.now();
      const fingerprint = fingerprintProject(loadedProject.project);
      options.onPhase?.({
        phase: "fingerprint",
        durationMs: performance.now() - phaseStartedAt,
      });

      const snapshot = snapshotsByProjectRoot.get(projectRoot);
      if (snapshot?.fingerprint === fingerprint) {
        snapshotsByProjectRoot.delete(projectRoot);
        snapshotsByProjectRoot.set(projectRoot, snapshot);
        return snapshot.graph;
      }

      phaseStartedAt = performance.now();
      const graph = scanProject(loadedProject.project);
      options.onPhase?.({ phase: "scan", durationMs: performance.now() - phaseStartedAt });
      snapshotsByProjectRoot.delete(projectRoot);
      snapshotsByProjectRoot.set(projectRoot, { projectRoot, fingerprint, graph });
      while (snapshotsByProjectRoot.size > maxSnapshots) {
        const leastRecentlyUsedRoot = snapshotsByProjectRoot.keys().next().value as
          string | undefined;
        if (leastRecentlyUsedRoot === undefined) break;
        snapshotsByProjectRoot.delete(leastRecentlyUsedRoot);
      }
      return graph;
    })();
    inFlightByProjectRoot.set(projectRoot, request);
    try {
      return await request;
    } finally {
      if (inFlightByProjectRoot.get(projectRoot) === request) {
        inFlightByProjectRoot.delete(projectRoot);
      }
    }
  };
};
