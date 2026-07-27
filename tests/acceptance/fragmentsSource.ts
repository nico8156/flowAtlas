import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");

export const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "tsconfig.json"));

export const readFragment = (relativeFile: string): Promise<string> =>
  readFile(resolve(fragmentsRoot, relativeFile), "utf8");

const findTypeScriptFiles = async (relativeDirectory: string): Promise<string[]> => {
  const entries = await readdir(resolve(fragmentsRoot, relativeDirectory), {
    withFileTypes: true,
  });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(relativePath)));
    } else if (relativePath.endsWith(".ts") || relativePath.endsWith(".tsx")) {
      files.push(relativePath);
    }
  }

  return files;
};

export const readFragmentProjectSources = async () => {
  const files = await findTypeScriptFiles("app");
  return Promise.all(
    files.map(async (file) => ({
      file,
      source: await readFragment(file),
    })),
  );
};
