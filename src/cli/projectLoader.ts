import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { TypeScriptProject } from "../scanner/projectSymbolResolver.js";

const sourceExtensions = new Set([".ts", ".tsx"]);

const normalizeRelativePath = (file: string): string => file.replaceAll("\\", "/");

export type ProjectLoadPhase =
  "config-read" | "file-discovery" | "source-read" | "manifest-inspection";

export type ProjectLoadMeasurement = {
  phase: ProjectLoadPhase;
  durationMs: number;
};

const findSourceFiles = async (directory: string, root: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;

    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findSourceFiles(absolutePath, root)));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(normalizeRelativePath(relative(root, absolutePath)));
    }
  }

  return files;
};

export const loadTypeScriptProject = async (
  projectPath: string,
): Promise<{
  name: string;
  project: TypeScriptProject;
  loadMeasurements: readonly ProjectLoadMeasurement[];
}> => {
  const root = resolve(projectPath);
  const tsconfigPath = resolve(root, "tsconfig.json");
  const loadMeasurements: ProjectLoadMeasurement[] = [];
  let startedAt = performance.now();
  const tsconfig = JSON.parse(
    await readFile(tsconfigPath, "utf8"),
  ) as TypeScriptProject["tsconfig"];
  loadMeasurements.push({ phase: "config-read", durationMs: performance.now() - startedAt });
  startedAt = performance.now();
  const files = await findSourceFiles(root, root);
  loadMeasurements.push({ phase: "file-discovery", durationMs: performance.now() - startedAt });
  startedAt = performance.now();
  const sources = await Promise.all(
    files.map(async (file) => ({
      file,
      source: await readFile(resolve(root, file), "utf8"),
    })),
  );
  loadMeasurements.push({ phase: "source-read", durationMs: performance.now() - startedAt });

  return {
    name: basename(root),
    loadMeasurements,
    project: {
      files: sources,
      projectFiles: sources,
      ...(process.env.FLOWATLAS_PROFILE === "1"
        ? {
            onScanPhase: ({ phase, durationMs }: { phase: string; durationMs: number }) => {
              process.stderr.write(`[FlowAtlas profile] ${phase}: ${durationMs.toFixed(2)}ms\n`);
            },
          }
        : {}),
      ...(tsconfig ? { tsconfig } : {}),
    },
  };
};
