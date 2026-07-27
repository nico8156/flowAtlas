import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");

export const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "tsconfig.json"));

export const readFragment = (relativeFile: string): Promise<string> =>
  readFile(resolve(fragmentsRoot, relativeFile), "utf8");
