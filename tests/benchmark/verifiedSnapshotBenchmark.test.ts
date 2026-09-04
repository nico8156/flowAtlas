import { describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { runVerifiedSnapshotBenchmark } from "../../src/benchmark/verifiedSnapshotBenchmark.js";

describe("verified snapshot benchmark", () => {
  it("reports the first scan separately from repeated verified snapshot loads", async () => {
    const project = { files: [{ file: "events.ts", source: "export const requested = true;" }] };
    const loadProject = vi.fn(async () => ({ name: "project", project }));
    const graph = createArchitectureGraph();
    graph.addNode({ id: "requested", kind: "Event" });
    const scanProject = vi.fn(() => graph);
    const timestamps = [0, 20, 20, 25, 25, 31];

    const result = await runVerifiedSnapshotBenchmark({
      projectPath: "/workspace/project",
      iterations: 3,
      loadProject,
      scanProject,
      now: () => timestamps.shift() ?? 31,
    });

    expect(result).toMatchObject({
      schemaVersion: 1,
      benchmark: "verified-mcp-snapshot",
      requests: 3,
      scans: 1,
      firstRequestMs: 20,
      repeatedRequestMs: [5, 6],
      repeatedMedianMs: 5.5,
      speedup: 3.64,
      graph: { nodes: 1, edges: 0 },
    });
    expect(loadProject).toHaveBeenCalledTimes(3);
    expect(scanProject).toHaveBeenCalledTimes(1);
  });
});
