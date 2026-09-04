import { describe, expect, it, vi } from "vitest";

import { createMetadataVerifiedProjectLoader } from "../../src/cli/metadataVerifiedProjectLoader.js";

describe("metadata-verified project loader", () => {
  it("reuses one loaded project until its deterministic manifest changes", async () => {
    let manifest = {
      tsconfig: { size: 10, mtimeMs: 1 },
      files: [{ file: "src/event.ts", size: 20, mtimeMs: 2 }],
    };
    const inspectManifest = vi.fn(async () => manifest);
    const first = { name: "project", project: { files: [] } };
    const second = { name: "project", project: { files: [] } };
    const loadProject = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const loader = createMetadataVerifiedProjectLoader({ inspectManifest, loadProject });

    expect((await loader("/workspace/project")).project).toBe(first.project);
    expect((await loader("/workspace/project")).project).toBe(first.project);

    manifest = {
      ...manifest,
      files: [...manifest.files, { file: "src/created.ts", size: 5, mtimeMs: 3 }],
    };
    expect((await loader("/workspace/project")).project).toBe(second.project);

    expect(inspectManifest).toHaveBeenCalledTimes(3);
    expect(loadProject).toHaveBeenCalledTimes(2);
  });

  it("does not confuse metadata verification with content verification", async () => {
    const manifest = {
      tsconfig: { size: 10, mtimeMs: 1 },
      files: [{ file: "src/event.ts", size: 20, mtimeMs: 2 }],
    };
    const inspectManifest = vi.fn(async () => manifest);
    const loaded = { name: "project", project: { files: [] } };
    const loadProject = vi.fn(async () => loaded);
    const loader = createMetadataVerifiedProjectLoader({ inspectManifest, loadProject });

    await loader("/workspace/project");
    await loader("/workspace/project");

    expect(loadProject).toHaveBeenCalledTimes(1);
  });

  it("updates a changed project from its previous per-file snapshot", async () => {
    let manifest = {
      tsconfig: { size: 10, mtimeMs: 1 },
      files: [{ file: "src/event.ts", size: 20, mtimeMs: 2 }],
    };
    const first = { name: "project", project: { files: [] } };
    const second = { name: "project", project: { files: [] } };
    const inspectManifest = vi.fn(async () => manifest);
    const loadProject = vi.fn(async () => first);
    const updateProject = vi.fn(async () => second);
    const loader = createMetadataVerifiedProjectLoader({
      inspectManifest,
      loadProject,
      updateProject,
    });

    await loader("/workspace/project");
    const previousManifest = manifest;
    manifest = {
      ...manifest,
      files: [{ file: "src/event.ts", size: 21, mtimeMs: 3 }],
    };
    expect((await loader("/workspace/project")).project).toBe(second.project);

    expect(loadProject).toHaveBeenCalledTimes(1);
    expect(updateProject).toHaveBeenCalledWith({
      projectPath: "/workspace/project",
      manifest,
      previousManifest,
      previousProject: first,
    });
  });
});
