import { describe, expect, it, vi } from "vitest";

import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { runVerifiedSnapshotBenchmark } from "../../src/benchmark/verifiedSnapshotBenchmark.js";

describe("verified snapshot benchmark", () => {
  it("reports the first scan separately from repeated verified snapshot loads", async () => {
    const project = { files: [{ file: "events.ts", source: "export const requested = true;" }] };
    const loadProject = vi.fn(async () => ({
      name: "project",
      project,
      loadMeasurements: [
        { phase: "config-read" as const, durationMs: 1 },
        { phase: "file-discovery" as const, durationMs: 2 },
        { phase: "source-read" as const, durationMs: 3 },
      ],
    }));
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
      verification: "content",
      requests: 3,
      scans: 1,
      firstRequestMs: 20,
      repeatedRequestMs: [5, 6],
      repeatedMedianMs: 5.5,
      speedup: 3.64,
      graph: { nodes: 1, edges: 0 },
      phases: {
        configReadMs: [1, 1, 1],
        fileDiscoveryMs: [2, 2, 2],
        sourceReadMs: [3, 3, 3],
        manifestInspectionMs: [],
      },
    });
    expect(result.phases.canonicalizationMs).toHaveLength(3);
    expect(result.phases.fingerprintMs).toHaveLength(3);
    expect(result.phases.scanMs).toHaveLength(1);
    expect(loadProject).toHaveBeenCalledTimes(3);
    expect(scanProject).toHaveBeenCalledTimes(1);
  });
});
