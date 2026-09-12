import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { ArchitectureScanner } from "../application/architectureScanner.js";
import { createJavaArchitectureScanner } from "./javaArchitectureScanner.js";

const execFileAsync = promisify(execFile);

export const formatJavaSemanticFailure = (requestPath: string, error: unknown): Error => {
  const detail =
    error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
      ? (error.stderr
          .trim()
          .split("\n")
          .find((line) => line.includes("Exception")) ?? error.stderr.trim())
      : error instanceof Error
        ? error.message
        : String(error);
  return new Error(
    `Java semantic request is stale or incomplete: ${requestPath}. ${detail}. ` +
      "Update scanSources or resolutionSources, or select a request matching the current vertical.",
  );
};
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
    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [findSemanticContextScript(), projectPath, requestPath],
        { maxBuffer: 1024 * 1024 },
      );
      return JSON.parse(stdout) as never;
    } catch (error) {
      throw formatJavaSemanticFailure(requestPath, error);
    }
  });
