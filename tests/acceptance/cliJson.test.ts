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

describe("FlowAtlas CLI JSON export", () => {
  it("exports the scanned ArchitectureGraph as JSON", async () => {
    const repositoryRoot = process.cwd();
    const fixtureProject = resolve(repositoryRoot, "tests/fixtures/cli-project");

    await execFileAsync("npm", ["run", "build"], { cwd: repositoryRoot });
    const result = await execFileAsync(
      process.execPath,
      [resolve(repositoryRoot, "dist/index.js"), "scan", "--json", fixtureProject],
      { cwd: repositoryRoot },
    );
    const exportedGraph = JSON.parse(result.stdout) as {
      nodes: Array<{ id: string; kind: string }>;
      edges: Array<{ source: string; target: string; kind: string }>;
    };

    expect(exportedGraph.nodes).toContainEqual({
      id: "uiLikeToggleRequested",
      kind: "Event",
      sourceLocation: { file: "actions.ts", line: 1 },
    });
    expect(exportedGraph.edges).toEqual([]);
  }, 30_000);
});
