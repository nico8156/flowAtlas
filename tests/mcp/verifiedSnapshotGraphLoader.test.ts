import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createVerifiedSnapshotGraphLoader } from "../../src/mcp/verifiedSnapshotGraphLoader.js";

describe("verified MCP graph snapshot", () => {
  it("shares one in-flight load and scan between concurrent requests for the same project", async () => {
    let resolveProject:
      ((value: { name: string; project: { files: never[] } }) => void) | undefined;
    const pendingProject = new Promise<{ name: string; project: { files: never[] } }>((resolve) => {
      resolveProject = resolve;
    });
    const loadProject = vi.fn(() => pendingProject);
    const graph = createArchitectureGraph();
    const scanProject = vi.fn(() => graph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    const first = loadGraph("/workspace/project");
    const second = loadGraph("/workspace/project");
    await vi.waitFor(() => expect(loadProject).toHaveBeenCalledTimes(1));
    resolveProject?.({ name: "project", project: { files: [] } });

    await expect(Promise.all([first, second])).resolves.toEqual([graph, graph]);
    expect(scanProject).toHaveBeenCalledTimes(1);
  });

  it("allows a new attempt after a shared in-flight failure", async () => {
    const project = { files: [] };
    let rejectProject: ((reason: Error) => void) | undefined;
    const failedProject = new Promise<never>((_resolve, reject) => {
      rejectProject = reject;
    });
    const loadProject = vi
      .fn()
      .mockReturnValueOnce(failedProject)
      .mockResolvedValueOnce({ name: "project", project });
    const graph = createArchitectureGraph();
    const scanProject = vi.fn(() => graph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    const first = loadGraph("/workspace/project");
    const second = loadGraph("/workspace/project");
    await vi.waitFor(() => expect(loadProject).toHaveBeenCalledTimes(1));
    rejectProject?.(new Error("load failed"));
    const failed = await Promise.allSettled([first, second]);
    expect(failed.map(({ status }) => status)).toEqual(["rejected", "rejected"]);
    await expect(loadGraph("/workspace/project")).resolves.toBe(graph);
    expect(loadProject).toHaveBeenCalledTimes(2);
  });

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

  it("reuses the graph through two filesystem paths to the same project", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "flowatlas-mcp-root-"));
    const projectRoot = join(temporaryRoot, "project");
    const projectAlias = join(temporaryRoot, "project-alias");
    const project = { files: [{ file: "events.ts", source: "export const requested = true;" }] };
    const loadProject = vi.fn(async () => ({ name: "project", project }));
    const graph = createArchitectureGraph();
    const scanProject = vi.fn(() => graph);
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject);

    try {
      await mkdir(projectRoot);
      await symlink(projectRoot, projectAlias, "dir");

      await loadGraph(projectRoot);
      await loadGraph(projectAlias);

      expect(scanProject).toHaveBeenCalledTimes(1);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
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

  it("reuses graphs across a bounded set of project roots", async () => {
    const loadProject = vi.fn(async (projectPath: string) => ({
      name: "project",
      project: { files: [{ file: "events.ts", source: projectPath }] },
    }));
    const scanProject = vi.fn(() => createArchitectureGraph());
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject, {
      maxSnapshots: 2,
    });

    await loadGraph("/workspace/first");
    await loadGraph("/workspace/second");
    await loadGraph("/workspace/first");

    expect(scanProject).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used project graph when the bound is reached", async () => {
    const loadProject = vi.fn(async (projectPath: string) => ({
      name: "project",
      project: { files: [{ file: "events.ts", source: projectPath }] },
    }));
    const scanProject = vi.fn(() => createArchitectureGraph());
    const loadGraph = createVerifiedSnapshotGraphLoader(loadProject, scanProject, {
      maxSnapshots: 2,
    });

    await loadGraph("/workspace/first");
    await loadGraph("/workspace/second");
    await loadGraph("/workspace/third");
    await loadGraph("/workspace/first");

    expect(scanProject).toHaveBeenCalledTimes(4);
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
