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

describe("FlowAtlas CLI focus", () => {
  it("renders a focused architectural territory in the terminal", async () => {
    const repositoryRoot = process.cwd();
    const fixtureProject = resolve(repositoryRoot, "tests/fixtures/cli-inspect-project");

    await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });
    const result = await execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "dist/index.js"), "focus", "uiLikeToggleRequested", fixtureProject],
      { cwd: repositoryRoot },
    );

    expect(result.stdout).toContain("FlowAtlas");
    expect(result.stdout).toContain("Focus: uiLikeToggleRequested");
    expect(result.stdout).toContain("[Event] uiLikeToggleRequested");
    expect(result.stdout).toContain("[Handler] likeToggleUseCaseFactory");
    expect(result.stdout).toContain("LISTENS_TO");
  }, 30_000);
});
