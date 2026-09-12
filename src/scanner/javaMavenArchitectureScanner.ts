import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { ArchitectureScanner } from "../application/architectureScanner.js";
import { createJavaArchitectureScanner } from "./javaArchitectureScanner.js";

const execFileAsync = promisify(execFile);
const findSemanticContextScript = (): string => {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = resolve(directory, "scripts/javaMavenSemanticContext.mjs");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(
        "Could not locate scripts/javaMavenSemanticContext.mjs from this FlowAtlas package",
      );
    }
    directory = parent;
  }
};

export const createJavaMavenArchitectureScanner = (): ArchitectureScanner =>
  createJavaArchitectureScanner(async (projectPath, requestPath) => {
    if (!requestPath) {
      throw new Error("Java scans require an explicit requestPath");
    }
    const { stdout } = await execFileAsync(
      process.execPath,
      [findSemanticContextScript(), projectPath, requestPath],
      { maxBuffer: 1024 * 1024 },
    );
    return JSON.parse(stdout) as never;
  });
