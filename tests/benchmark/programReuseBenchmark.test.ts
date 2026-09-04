import { describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { runProgramReuseBenchmark } from "../../src/benchmark/programReuseBenchmark.js";
import type { TypeScriptProject } from "../../src/scanner/projectSymbolResolver.js";

describe("compiler program reuse benchmark", () => {
  it("compares a changed-project reused scan with an equivalent cold scan", async () => {
    const project: TypeScriptProject = {
      files: [{ file: "src/event.ts", source: "export const requested = true;" }],
    };
    const loadProject = vi.fn(async () => ({ name: "project", project }));
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    const reusedScan = vi.fn((input: TypeScriptProject) => {
      input.onScanPhase?.({ phase: "compiler-context", durationMs: 2 });
      return graph;
    });
    const coldScan = vi.fn((input: TypeScriptProject) => {
      input.onScanPhase?.({ phase: "compiler-context", durationMs: 6 });
      return graph;
    });
    const timestamps = [0, 10, 10, 14, 14, 22];

    const result = await runProgramReuseBenchmark({
      projectPath: "/workspace/project",
      changedFile: "src/event.ts",
      loadProject,
      reusedScan,
      coldScan,
      now: () => timestamps.shift() ?? 22,
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      benchmark: "typescript-program-reuse",
      initialScanMs: 10,
      reusedScanMs: 4,
      coldComparisonMs: 8,
      compilerContextMs: { reused: 2, coldComparison: 6 },
      equivalentGraph: true,
    });
    expect(reusedScan.mock.calls[1]?.[0].files[0]?.source).toMatch(/\n$/);
  });
});
