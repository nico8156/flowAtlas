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

describe("FlowAtlas CLI errors", () => {
  it("reports a missing inspected node without a stack trace", async () => {
    const repositoryRoot = process.cwd();
    const fixtureProject = resolve(repositoryRoot, "tests/fixtures/cli-inspect-project");

    await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });

    let error: unknown;
    try {
      await execFileAsync(
        process.execPath,
        [resolve(repositoryRoot, "dist/index.js"), "inspect", "missingNode", fixtureProject],
        { cwd: repositoryRoot },
      );
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: 1,
      stdout: "",
      stderr: "FlowAtlas: Node not found: missingNode\n",
    });
    expect(String(error)).not.toContain("at ");
  }, 30_000);
});
