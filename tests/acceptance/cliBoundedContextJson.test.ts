import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../../src/cli.js";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");
const describeFragments = existsSync(resolve(fragmentsRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeFragments("FlowAtlas CLI bounded context", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops a real projection deterministically and exposes its unexplored frontier", async () => {
    let output = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });

    await runCli([
      "context",
      "lState",
      fragmentsRoot,
      "--direction",
      "both",
      "--depth",
      "4",
      "--max-nodes",
      "6",
      "--max-edges",
      "4",
      "--json",
    ]);

    const context = JSON.parse(output) as {
      complete: boolean;
      request: { maxNodes?: number; maxEdges?: number };
      returned: { nodes: number; edges: number };
      frontier: Array<{
        nodeId: string;
        traversal: string;
        via: { source: string; target: string; kind: string };
      }>;
      projection: {
        nodes: Array<{ id: string }>;
        edges: Array<{ source: string; target: string; kind: string }>;
      };
    };

    expect(context).toMatchObject({
      complete: false,
      request: { maxNodes: 6, maxEdges: 4 },
      returned: { nodes: 5, edges: 4 },
    });
    expect(context.projection.nodes.map(({ id }) => id)).toEqual([
      "lState",
      "likeOptimisticApplied",
      "likeReconciled",
      "likeRollback",
      "likesRetrievalFailed",
    ]);
    expect(context.projection.edges).toHaveLength(4);
    expect(context.projection.edges.every((edge) => edge.target === "lState")).toBe(true);
    expect(context.frontier).toEqual(
      expect.arrayContaining([
        {
          nodeId: "likesRetrievalPending",
          traversal: "upstream",
          via: {
            source: "likesRetrievalPending",
            target: "lState",
            kind: "UPDATES",
          },
        },
      ]),
    );
    expect(context.projection.nodes).not.toContainEqual({ id: "likesRetrievalPending" });
  }, 120_000);
});
