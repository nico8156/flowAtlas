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

describe("FlowAtlas CLI inspect", () => {
  it("shows a node, its source and its immediate canonical relations", async () => {
    const repositoryRoot = process.cwd();
    const fixtureProject = resolve(repositoryRoot, "tests/fixtures/cli-inspect-project");

    await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });
    const result = await execFileAsync(
      process.execPath,
      [
        resolve(repositoryRoot, "dist/index.js"),
        "inspect",
        "uiLikeToggleRequested",
        fixtureProject,
      ],
      { cwd: repositoryRoot },
    );

    expect(result.stdout).toContain("Node: uiLikeToggleRequested");
    expect(result.stdout).toContain("Kind: Event");
    expect(result.stdout).toMatch(/Source: actions\.ts:\d+/);
    expect(result.stdout).toContain("Incoming relations:");
    expect(result.stdout).toContain(
      "- likeToggleUseCaseFactory --LISTENS_TO--> uiLikeToggleRequested",
    );
    expect(result.stdout).toContain("Outgoing relations:");
    expect(result.stdout).toContain("- none");
  }, 30_000);
});
