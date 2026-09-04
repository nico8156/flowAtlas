import { readFile, readdir, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { ProjectLoadMeasurement } from "./projectLoader.js";
import type { TypeScriptProject } from "../scanner/projectSymbolResolver.js";

type LoadedTypeScriptProject = {
  name: string;
  project: TypeScriptProject;
  loadMeasurements?: readonly ProjectLoadMeasurement[];
};

export type ProjectManifest = {
  tsconfig: { size: number; mtimeMs: number };
  files: readonly { file: string; size: number; mtimeMs: number }[];
};

type MetadataVerifiedProjectLoaderDependencies<TLoaded extends LoadedTypeScriptProject> = {
  inspectManifest: (projectPath: string) => Promise<ProjectManifest>;
  loadProject: (projectPath: string) => Promise<TLoaded>;
  updateProject?: (input: {
    projectPath: string;
    manifest: ProjectManifest;
    previousManifest: ProjectManifest;
    previousProject: TLoaded;
  }) => Promise<TLoaded>;
};

type MetadataProjectSnapshot<TLoaded extends LoadedTypeScriptProject> = {
  projectPath: string;
  manifest: ProjectManifest;
  manifestFingerprint: string;
  loadedProject: TLoaded;
};

const sourceExtensions = new Set([".ts", ".tsx"]);

const discoverSourcePaths = async (directory: string, root: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const discovered = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      if (entry.name === "node_modules" || entry.name === "dist") return [];
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) return discoverSourcePaths(absolutePath, root);
      return sourceExtensions.has(extname(entry.name))
        ? [relative(root, absolutePath).replaceAll("\\", "/")]
        : [];
    }),
  );

  return discovered.flat();
};

const metadata = async (path: string): Promise<{ size: number; mtimeMs: number }> => {
  const value = await stat(path);
  return { size: value.size, mtimeMs: value.mtimeMs };
};

export const inspectTypeScriptProjectManifest = async (
  projectPath: string,
): Promise<ProjectManifest> => {
  const root = resolve(projectPath);
  const files = (await discoverSourcePaths(root, root)).sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    tsconfig: await metadata(resolve(root, "tsconfig.json")),
    files: await Promise.all(
      files.map(async (file) => ({ file, ...(await metadata(resolve(root, file))) })),
    ),
  };
};

const sameMetadata = (
  left: { size: number; mtimeMs: number } | undefined,
  right: { size: number; mtimeMs: number },
): boolean => left?.size === right.size && left.mtimeMs === right.mtimeMs;

export const updateTypeScriptProjectFromManifest = async ({
  projectPath,
  manifest,
  previousManifest,
  previousProject,
}: {
  projectPath: string;
  manifest: ProjectManifest;
  previousManifest: ProjectManifest;
  previousProject: LoadedTypeScriptProject;
}): Promise<LoadedTypeScriptProject & { loadMeasurements: readonly ProjectLoadMeasurement[] }> => {
  const root = resolve(projectPath);
  const measurements: ProjectLoadMeasurement[] = [];
  const previousMetadata = new Map(previousManifest.files.map((entry) => [entry.file, entry]));
  const previousSources = new Map(
    (previousProject.project.projectFiles ?? previousProject.project.files).map((source) => [
      source.file,
      source,
    ]),
  );
  const sourceStartedAt = performance.now();
  const sources = await Promise.all(
    manifest.files.map(async (entry) => {
      const previousSource = previousSources.get(entry.file);
      if (previousSource && sameMetadata(previousMetadata.get(entry.file), entry)) {
        return previousSource;
      }
      return { file: entry.file, source: await readFile(resolve(root, entry.file), "utf8") };
    }),
  );
  measurements.push({
    phase: "source-read",
    durationMs: performance.now() - sourceStartedAt,
  });

  let tsconfig = previousProject.project.tsconfig;
  if (!sameMetadata(previousManifest.tsconfig, manifest.tsconfig)) {
    const configStartedAt = performance.now();
    tsconfig = JSON.parse(
      await readFile(resolve(root, "tsconfig.json"), "utf8"),
    ) as TypeScriptProject["tsconfig"];
    measurements.push({
      phase: "config-read",
      durationMs: performance.now() - configStartedAt,
    });
  }

  return {
    name: previousProject.name,
    loadMeasurements: measurements,
    project: {
      ...previousProject.project,
      files: sources,
      projectFiles: sources,
      ...(tsconfig ? { tsconfig } : {}),
    },
  };
};

export const createMetadataVerifiedProjectLoader = <TLoaded extends LoadedTypeScriptProject>({
  inspectManifest,
  loadProject,
  updateProject,
}: MetadataVerifiedProjectLoaderDependencies<TLoaded>): ((
  projectPath: string,
) => Promise<TLoaded>) => {
  let snapshot: MetadataProjectSnapshot<TLoaded> | undefined;

  return async (projectPath) => {
    const startedAt = performance.now();
    const manifest = await inspectManifest(projectPath);
    const manifestMeasurement: ProjectLoadMeasurement = {
      phase: "manifest-inspection",
      durationMs: performance.now() - startedAt,
    };
    const manifestFingerprint = JSON.stringify(manifest);
    if (
      snapshot?.projectPath === projectPath &&
      snapshot.manifestFingerprint === manifestFingerprint
    ) {
      return {
        ...snapshot.loadedProject,
        loadMeasurements: [manifestMeasurement],
      };
    }

    const loadedProject =
      snapshot?.projectPath === projectPath && updateProject
        ? await updateProject({
            projectPath,
            manifest,
            previousManifest: snapshot.manifest,
            previousProject: snapshot.loadedProject,
          })
        : await loadProject(projectPath);
    snapshot = { projectPath, manifest, manifestFingerprint, loadedProject };
    return {
      ...loadedProject,
      loadMeasurements: [manifestMeasurement, ...(loadedProject.loadMeasurements ?? [])],
    };
  };
};
