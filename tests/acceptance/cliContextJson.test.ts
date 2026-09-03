import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../../src/cli.js";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");
const describeFragments = existsSync(resolve(fragmentsRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeFragments("FlowAtlas CLI focused JSON context", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a depth-limited architectural context from a real Like event", async () => {
    let output = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });

    await runCli([
      "context",
      "uiLikeToggleRequested",
      fragmentsRoot,
      "--direction",
      "both",
      "--depth",
      "2",
      "--json",
    ]);

    const context = JSON.parse(output) as {
      schemaVersion: number;
      focus: { id: string; kind: string; sourceLocation?: { file: string; line: number } };
      request: { direction: string; maxDepth: number };
      projection: {
        nodes: Array<{ id: string; kind: string }>;
        edges: Array<{ source: string; target: string; kind: string }>;
      };
    };

    expect(context).toMatchObject({
      schemaVersion: 1,
      focus: { id: "uiLikeToggleRequested", kind: "Event" },
      request: { direction: "both", maxDepth: 2 },
    });
    expect(context.focus.sourceLocation?.file).toContain("likePressedUseCase.ts");
    expect(context.projection.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "uiLikeToggleRequested", kind: "Event" }),
        expect.objectContaining({ id: "likeToggleUseCaseFactory", kind: "Handler" }),
        expect.objectContaining({ id: "likeOptimisticApplied", kind: "Event" }),
        expect.objectContaining({ id: "unlikeOptimisticApplied", kind: "Event" }),
      ]),
    );
    expect(context.projection.nodes).not.toContainEqual(expect.objectContaining({ id: "lState" }));
    expect(context.projection.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "likeToggleUseCaseFactory",
          target: "uiLikeToggleRequested",
          kind: "LISTENS_TO",
        }),
        expect.objectContaining({
          source: "likeToggleUseCaseFactory",
          target: "likeOptimisticApplied",
          kind: "DISPATCHES",
        }),
      ]),
    );
  }, 60_000);
});
