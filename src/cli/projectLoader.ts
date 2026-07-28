import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";

import type { TypeScriptProject } from "../scanner/projectSymbolResolver.js";

const sourceExtensions = new Set([".ts", ".tsx"]);

const normalizeRelativePath = (file: string): string => file.replaceAll("\\", "/");

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
}> => {
  const root = resolve(projectPath);
  const tsconfigPath = resolve(root, "tsconfig.json");
  const tsconfig = JSON.parse(
    await readFile(tsconfigPath, "utf8"),
  ) as TypeScriptProject["tsconfig"];
  const files = await findSourceFiles(root, root);
  const sources = await Promise.all(
    files.map(async (file) => ({
      file,
      source: await readFile(resolve(root, file), "utf8"),
    })),
  );

  return {
    name: basename(root),
    project: {
      files: sources,
      projectFiles: sources,
      ...(tsconfig ? { tsconfig } : {}),
    },
  };
};
