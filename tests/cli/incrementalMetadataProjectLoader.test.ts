import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadTypeScriptProject } from "../../src/cli/projectLoader.js";
import {
  inspectTypeScriptProjectManifest,
  updateTypeScriptProjectFromManifest,
} from "../../src/cli/metadataVerifiedProjectLoader.js";

describe("incremental metadata project loading", () => {
  it("reuses unchanged sources while applying creation, modification and deletion", async () => {
    const root = await mkdtemp(join(tmpdir(), "flowatlas-metadata-project-"));
    try {
      await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
      await writeFile(join(root, "changed.ts"), "export const changed = 1;\n");
      await writeFile(join(root, "deleted.ts"), "export const deleted = true;\n");
      await writeFile(join(root, "unchanged.ts"), "export const unchanged = true;\n");
      const previousManifest = await inspectTypeScriptProjectManifest(root);
      const previousProject = await loadTypeScriptProject(root);
      const unchangedSource = previousProject.project.files.find(
        ({ file }) => file === "unchanged.ts",
      );

      await writeFile(join(root, "changed.ts"), "export const changed = 200;\n");
      await rm(join(root, "deleted.ts"));
      await writeFile(join(root, "created.ts"), "export const created = true;\n");
      const manifest = await inspectTypeScriptProjectManifest(root);
      const updated = await updateTypeScriptProjectFromManifest({
        projectPath: root,
        manifest,
        previousManifest,
        previousProject,
      });

      expect(updated.project.files.map(({ file }) => file)).toEqual([
        "changed.ts",
        "created.ts",
        "unchanged.ts",
      ]);
      expect(updated.project.files.find(({ file }) => file === "changed.ts")?.source).toContain(
        "200",
      );
      expect(updated.project.files.find(({ file }) => file === "unchanged.ts")).toBe(
        unchangedSource,
      );

      await writeFile(
        join(root, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true } }),
      );
      const configManifest = await inspectTypeScriptProjectManifest(root);
      const configUpdated = await updateTypeScriptProjectFromManifest({
        projectPath: root,
        manifest: configManifest,
        previousManifest: manifest,
        previousProject: updated,
      });

      expect(configUpdated.project.tsconfig).toEqual({ compilerOptions: { strict: true } });
      expect(configUpdated.project.files[0]).toBe(updated.project.files[0]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
