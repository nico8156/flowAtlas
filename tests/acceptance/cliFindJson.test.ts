import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../../src/cli.js";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_ROOT ?? "../fragmentsCleanFront");
const describeFragments = existsSync(resolve(fragmentsRoot, "tsconfig.json"))
  ? describe
  : describe.skip;

describeFragments("FlowAtlas CLI node discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a limited deterministic set of real Event candidates", async () => {
    let output = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output += String(chunk);
      return true;
    });

    await runCli(["find", "like", fragmentsRoot, "--kind", "Event", "--limit", "3", "--json"]);

    const discovery = JSON.parse(output) as {
      schemaVersion: number;
      query: string;
      request: { kinds: string[]; limit: number };
      matches: Array<{
        id: string;
        kind: string;
        sourceLocation?: { file: string; line: number };
      }>;
    };

    expect(discovery).toMatchObject({
      schemaVersion: 1,
      query: "like",
      request: { kinds: ["Event"], limit: 3 },
    });
    expect(discovery.matches.map(({ id }) => id)).toEqual([
      "likeOptimisticApplied",
      "likeReconciled",
      "likeRollback",
    ]);
    expect(discovery.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "likeOptimisticApplied",
          kind: "Event",
          sourceLocation: expect.objectContaining({
            file: expect.stringContaining("likeWl.action.ts"),
          }),
        }),
      ]),
    );
  }, 120_000);
});
