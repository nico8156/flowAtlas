import { performance } from "node:perf_hooks";

import type { ProjectLoadMeasurement } from "../cli/projectLoader.js";
import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import { createVerifiedSnapshotGraphLoader } from "../mcp/verifiedSnapshotGraphLoader.js";
import type { TypeScriptProject } from "../scanner/projectSymbolResolver.js";

type LoadedTypeScriptProject = {
  name: string;
  project: TypeScriptProject;
  loadMeasurements?: readonly ProjectLoadMeasurement[];
};

type BenchmarkOptions = {
  projectPath: string;
  iterations: number;
  loadProject: (projectPath: string) => Promise<LoadedTypeScriptProject>;
  scanProject: (project: TypeScriptProject) => ArchitectureGraph;
  verification?: "content" | "metadata";
  now?: () => number;
};

const round = (value: number): number => Math.round(value * 100) / 100;

const median = (values: readonly number[]): number => {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? ((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2
    : (ordered[middle] ?? 0);
};

export const runVerifiedSnapshotBenchmark = async ({
  projectPath,
  iterations,
  loadProject,
  scanProject,
  verification = "content",
  now = () => performance.now(),
}: BenchmarkOptions) => {
  if (!Number.isInteger(iterations) || iterations < 2) {
    throw new Error("Benchmark iterations must be an integer greater than one.");
  }

  let scans = 0;
  const phases = {
    configReadMs: [] as number[],
    fileDiscoveryMs: [] as number[],
    sourceReadMs: [] as number[],
    manifestInspectionMs: [] as number[],
    canonicalizationMs: [] as number[],
    fingerprintMs: [] as number[],
    scanMs: [] as number[],
  };
  const measuredLoadProject = async (path: string): Promise<LoadedTypeScriptProject> => {
    const loaded = await loadProject(path);
    for (const measurement of loaded.loadMeasurements ?? []) {
      const value = round(measurement.durationMs);
      if (measurement.phase === "config-read") phases.configReadMs.push(value);
      if (measurement.phase === "file-discovery") phases.fileDiscoveryMs.push(value);
      if (measurement.phase === "source-read") phases.sourceReadMs.push(value);
      if (measurement.phase === "manifest-inspection") phases.manifestInspectionMs.push(value);
    }
    return loaded;
  };
  const loadGraph = createVerifiedSnapshotGraphLoader(
    measuredLoadProject,
    (project) => {
      scans += 1;
      return scanProject(project);
    },
    {
      onPhase: ({ phase, durationMs }) => {
        phases[`${phase}Ms`].push(round(durationMs));
      },
    },
  );
  const samples: number[] = [];
  let graph: ArchitectureGraph | undefined;

  for (let index = 0; index < iterations; index += 1) {
    const startedAt = now();
    graph = await loadGraph(projectPath);
    samples.push(round(now() - startedAt));
  }

  const firstRequestMs = samples[0] ?? 0;
  const repeatedRequestMs = samples.slice(1);
  const repeatedMedianMs = round(median(repeatedRequestMs));

  return {
    schemaVersion: 1 as const,
    benchmark: "verified-mcp-snapshot" as const,
    verification,
    projectPath,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    requests: iterations,
    scans,
    firstRequestMs,
    repeatedRequestMs,
    repeatedMedianMs,
    speedup: repeatedMedianMs === 0 ? null : round(firstRequestMs / repeatedMedianMs),
    graph: {
      nodes: graph?.nodes.length ?? 0,
      edges: graph?.edges.length ?? 0,
    },
    phases,
  };
};
