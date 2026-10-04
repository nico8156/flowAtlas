import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

const root = resolve(
  process.env.FLOWATLAS_FRAGMENTS_STUDIO_ROOT ?? "../fragments-admin/fragments-studio",
);
const listenerFile = "src/communityContext/write/communityListeners.ts";
const describeStudio = existsSync(resolve(root, listenerFile)) ? describe : describe.skip;

describeStudio("Fragments Studio namespace listeners", () => {
  it("preserves the three observed community listener projections with namespace imports", async () => {
    const files = await Promise.all(
      [
        listenerFile,
        "src/communityContext/write/communityState.ts",
        "src/studioOperationContext/write/model/studioOperationEvents.ts",
        "src/projectionSyncContext/write/model/projectionSyncEvents.ts",
      ].map(async (file) => ({
        file: resolve(root, file),
        source: await readFile(resolve(root, file), "utf8"),
      })),
    );
    const original = files[0]!.source;
    const importPattern = /import\s*\{([^}]+)\}\s*from\s*"\.\/communityState";/;
    const importedNames = original
      .match(importPattern)?.[1]
      ?.split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    expect(importedNames?.length).toBeGreaterThan(0);
    let namespaceSource = original.replace(
      importPattern,
      'import * as community from "./communityState";',
    );
    for (const name of importedNames!) {
      namespaceSource = namespaceSource.replace(
        new RegExp(`\\b${name}\\b`, "g"),
        `community.${name}`,
      );
    }
    const named = scanTypeScriptProject({ files });
    const namespaced = scanTypeScriptProject({
      files: files.map((file) =>
        file.file === resolve(root, listenerFile) ? { ...file, source: namespaceSource } : file,
      ),
    });
    const events = ["communityOpened", "communityCommandChanged", "communityCommandCheckRequested"];
    const dispatchTargets = [
      ["communityDetailLoaded", "communitySearchRequested", "communityFailed"],
      ["studioOperationStatusChanged"],
      ["communityCommandChanged", "communityDetailLoaded", "communitySearchRequested"],
    ];
    for (const event of events) {
      const handler = `createCommunityListeners[${event}]`;
      const expected = named.edges.filter((edge) => edge.source === handler);
      expect(expected).toContainEqual({ source: handler, target: event, kind: "LISTENS_TO" });
      for (const target of dispatchTargets[events.indexOf(event)]!) {
        expect(expected).toContainEqual({ source: handler, target, kind: "DISPATCHES" });
      }
      expect(namespaced.edges.filter((edge) => edge.source === handler)).toEqual(expected);
    }
    expect(namespaced.edges).not.toContainEqual({
      source: "createCommunityListeners[communityOpened]",
      target: "communityCommandCheckRequested",
      kind: "DISPATCHES",
    });
  }, 60_000);
});
