import { execFile } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const execFileAsync = (
  file: string,
  arguments_: readonly string[],
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolvePromise, reject) => {
    execFile(file, arguments_, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
        return;
      }

      resolvePromise({ stdout, stderr });
    });
  });

describe("FlowAtlas CLI", () => {
  it("scans a TypeScript project and prints a deterministic architecture summary", async () => {
    const repositoryRoot = process.cwd();
    const fixtureProject = resolve(repositoryRoot, "tests/fixtures/cli-project");

    await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });
    const result = await execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "dist/index.js"), "scan", fixtureProject],
      { cwd: repositoryRoot },
    );

    expect(result.stdout).toContain("FlowAtlas");
    expect(result.stdout).toContain("TypeScript files: 1");
    expect(result.stdout).toContain("Events: 1");
    expect(result.stdout).toContain("Handlers: 0");
    expect(result.stdout).toContain("States: 0");
    expect(result.stdout).toContain("Externals: 0");
    expect(result.stdout).toContain("Relations: 0");
    expect(result.stdout).toContain("Scan completed.");
  }, 30_000);
});
