import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Like acceptance", () => {
  it("reconstructs the first architectural Like slice", async () => {
    const files = [
      "app/core-logic/contextWL/likeWl/usecases/write/likePressedUseCase.ts",
      "app/core-logic/contextWL/likeWl/typeAction/likeWl.action.ts",
      "app/core-logic/contextWL/likeWl/reducer/likeWl.reducer.ts",
      "app/store/reduxStoreWl.ts",
    ];
    const tsconfig = JSON.parse(await readFragment("tsconfig.json")) as {
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
      };
    };

    const graph = scanTypeScriptProject({
      tsconfig,
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFragment(file),
        })),
      ),
    });

    const relevantNodeIds = new Set([
      "uiLikeToggleRequested",
      "likeToggleUseCaseFactory",
      "likeOptimisticApplied",
      "unlikeOptimisticApplied",
      "lState",
    ]);

    const actual = {
      nodes: graph.nodes
        .filter((node) => relevantNodeIds.has(node.id))
        .map(({ id, kind }) => ({ id, kind })),
      edges: graph.edges.filter(
        (edge) => relevantNodeIds.has(edge.source) || relevantNodeIds.has(edge.target),
      ),
    };

    expect(actual.nodes).toEqual(
      expect.arrayContaining([
        { id: "uiLikeToggleRequested", kind: "Event" },
        { id: "likeToggleUseCaseFactory", kind: "Handler" },
        { id: "likeOptimisticApplied", kind: "Event" },
        { id: "unlikeOptimisticApplied", kind: "Event" },
        { id: "lState", kind: "State" },
      ]),
    );
    expect(actual.edges).toEqual(
      expect.arrayContaining([
        {
          source: "likeToggleUseCaseFactory",
          target: "uiLikeToggleRequested",
          kind: "LISTENS_TO",
        },
        {
          source: "likeToggleUseCaseFactory",
          target: "likeOptimisticApplied",
          kind: "DISPATCHES",
        },
        {
          source: "likeToggleUseCaseFactory",
          target: "unlikeOptimisticApplied",
          kind: "DISPATCHES",
        },
        {
          source: "likeOptimisticApplied",
          target: "lState",
          kind: "UPDATES",
        },
      ]),
    );
    expect(graph.edges).not.toContainEqual({
      source: "likeToggleUseCaseFactory",
      target: "likeReconciled",
      kind: "DISPATCHES",
    });
  });
});
