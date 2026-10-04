import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { readFixture } from "./fixtureSource.js";

describe("Namespace-imported listener events", () => {
  it("resolves registrations and dispatches to the imported declarations without name collisions", async () => {
    const files = await Promise.all(
      ["events.ts", "otherEvents.ts", "listeners.ts"].map(async (name) => ({
        file: `tests/fixtures/namespaceListeners/${name}`,
        source: await readFixture(`namespaceListeners/${name}`),
      })),
    );
    const graph = scanTypeScriptProject({ files });
    const opened = `${files[0]!.file}#opened`;
    const changed = `${files[0]!.file}#changed`;

    expect(graph.edges).toEqual([
      { source: `createCommunityListeners[${opened}]`, target: opened, kind: "LISTENS_TO" },
      { source: `createCommunityListeners[${opened}]`, target: changed, kind: "DISPATCHES" },
      { source: `createCommunityListeners[${changed}]`, target: changed, kind: "LISTENS_TO" },
    ]);
  });

  it("omits namespace relations to events outside the architectural scan scope", async () => {
    const projectFiles = await Promise.all(
      ["events.ts", "listeners.ts"].map(async (name) => ({
        file: `tests/fixtures/namespaceListeners/${name}`,
        source: await readFixture(`namespaceListeners/${name}`),
      })),
    );
    const graph = scanTypeScriptProject({ files: [projectFiles[1]!], projectFiles });
    expect(graph.nodes.every((node) => node.kind === "Handler")).toBe(true);
    expect(graph.edges).toEqual([]);
  });
});
