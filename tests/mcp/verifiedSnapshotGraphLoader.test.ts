import { describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createVerifiedSnapshotGraphLoader } from "../../src/mcp/verifiedSnapshotGraphLoader.js";

describe("verified MCP graph snapshot", () => {
  it("reuses the graph when the verified project content is unchanged", async () => {
    const project = {
      files: [{ file: "events.ts", source: "export const requested = createAction('requested');" }],
      projectFiles: [
        { file: "events.ts", source: "export const requested = createAction('requested');" },
      ],
      tsconfig: { compilerOptions: { baseUrl: "." } },
    };
    const loadProject = vi.fn(async () => ({ name: "project", project }));
    const graph = createArchitectureGraph();
    const scanProject = vi.fn(() => graph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    const first = await loadGraph("/workspace/project");
    const second = await loadGraph("/workspace/project/.");

    expect(first).toBe(graph);
    expect(second).toBe(graph);
    expect(loadProject).toHaveBeenCalledTimes(2);
    expect(scanProject).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the graph when the project content changes", async () => {
    let source = "export const requested = createAction('requested');";
    const loadProject = vi.fn(async () => ({
      name: "project",
      project: {
        files: [{ file: "events.ts", source }],
        projectFiles: [{ file: "events.ts", source }],
        tsconfig: { compilerOptions: { baseUrl: "." } },
      },
    }));
    const firstGraph = createArchitectureGraph();
    const secondGraph = createArchitectureGraph();
    const scanProject = vi.fn().mockReturnValueOnce(firstGraph).mockReturnValueOnce(secondGraph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    expect(await loadGraph("/workspace/project")).toBe(firstGraph);
    source = "export const succeeded = createAction('succeeded');";
    expect(await loadGraph("/workspace/project")).toBe(secondGraph);

    expect(scanProject).toHaveBeenCalledTimes(2);
  });

  it("does not share a retained graph between project roots", async () => {
    const loadProject = vi.fn(async (projectPath: string) => ({
      name: "project",
      project: {
        files: [{ file: "events.ts", source: `export const root = '${projectPath}';` }],
      },
    }));
    const firstGraph = createArchitectureGraph();
    const secondGraph = createArchitectureGraph();
    const scanProject = vi.fn().mockReturnValueOnce(firstGraph).mockReturnValueOnce(secondGraph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    expect(await loadGraph("/workspace/first")).toBe(firstGraph);
    expect(await loadGraph("/workspace/second")).toBe(secondGraph);
    expect(scanProject).toHaveBeenCalledTimes(2);
  });

  it("returns a rebuild failure instead of the previously retained graph", async () => {
    let source = "export const requested = createAction('requested');";
    const loadProject = vi.fn(async () => ({
      name: "project",
      project: { files: [{ file: "events.ts", source }] },
    }));
    const graph = createArchitectureGraph();
    const scanProject = vi
      .fn()
      .mockReturnValueOnce(graph)
      .mockImplementationOnce(() => {
        throw new Error("scan failed");
      });
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    expect(await loadGraph("/workspace/project")).toBe(graph);
    source = "export const changed = createAction('changed');";

    await expect(loadGraph("/workspace/project")).rejects.toThrow("scan failed");
    expect(scanProject).toHaveBeenCalledTimes(2);
  });
});
