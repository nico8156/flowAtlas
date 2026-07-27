import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments likesRetrieval regression", () => {
  it("resolves the gateway used by the real AppThunkWl declaration", async () => {
    const files = [
      "app/core-logic/contextWL/likeWl/usecases/read/likeRetrieval.ts",
      "app/core-logic/contextWL/likeWl/gateway/likeWl.gateway.ts",
    ];
    const projectFiles = [
      ...files,
      "app/store/reduxStoreWl.ts",
      "app/store/appStateWl.ts",
      "app/adapters/primary/wiring/types.ts",
    ];
    const tsconfig = JSON.parse(await readFragment("tsconfig.json")) as {
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
      };
    };

    const sources = async (file: string) => ({
      file,
      source: await readFragment(file),
    });
    const graph = scanTypeScriptProject({
      tsconfig,
      files: await Promise.all(files.map(sources)),
      projectFiles: await Promise.all(projectFiles.map(sources)),
    });
    expect(graph.edges).toContainEqual({
      source: "likesRetrieval",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
  });
});
