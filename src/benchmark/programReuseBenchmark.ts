import { performance } from "node:perf_hooks";

import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import type { ScanPhaseMeasurement, TypeScriptProject } from "../scanner/projectSymbolResolver.js";

type LoadedTypeScriptProject = { name: string; project: TypeScriptProject };

type ProgramReuseBenchmarkOptions = {
  projectPath: string;
  changedFile: string;
  loadProject: (projectPath: string) => Promise<LoadedTypeScriptProject>;
  reusedScan: (project: TypeScriptProject, projectRoot: string) => ArchitectureGraph;
  coldScan: (project: TypeScriptProject) => ArchitectureGraph;
  now?: () => number;
};

const round = (value: number): number => Math.round(value * 100) / 100;

const graphValue = (graph: ArchitectureGraph): string =>
  JSON.stringify({ nodes: graph.nodes, edges: graph.edges });

const measuredProject = (
  project: TypeScriptProject,
  onCompilerContext: (durationMs: number) => void,
  forwardMeasurements = true,
): TypeScriptProject => ({
  ...project,
  onScanPhase: (measurement: ScanPhaseMeasurement) => {
    if (forwardMeasurements) project.onScanPhase?.(measurement);
    if (measurement.phase === "compiler-context") {
      onCompilerContext(round(measurement.durationMs));
    }
  },
});

export const runProgramReuseBenchmark = async ({
  projectPath,
  changedFile,
  loadProject,
  reusedScan,
  coldScan,
  now = () => performance.now(),
}: ProgramReuseBenchmarkOptions) => {
  const loaded = await loadProject(projectPath);
  const source = loaded.project.files.find(({ file }) => file === changedFile);
  if (!source) throw new Error(`Benchmark change file not found: ${changedFile}`);

  const compilerContextMs: { initial?: number; reused?: number; coldComparison?: number } = {};
  const initialProject = measuredProject(loaded.project, (durationMs) => {
    compilerContextMs.initial = durationMs;
  });
  let startedAt = now();
  reusedScan(initialProject, projectPath);
  const initialScanMs = round(now() - startedAt);

  const changedProject = measuredProject(
    {
      ...loaded.project,
      files: loaded.project.files.map((candidate) =>
        candidate.file === changedFile
          ? { ...candidate, source: `${candidate.source}\n` }
          : candidate,
      ),
      projectFiles: (loaded.project.projectFiles ?? loaded.project.files).map((candidate) =>
        candidate.file === changedFile
          ? { ...candidate, source: `${candidate.source}\n` }
          : candidate,
      ),
    },
    (durationMs) => {
      compilerContextMs.reused = durationMs;
    },
  );
  startedAt = now();
  const reusedGraph = reusedScan(changedProject, projectPath);
  const reusedScanMs = round(now() - startedAt);

  const coldProject = measuredProject(
    changedProject,
    (durationMs) => {
      compilerContextMs.coldComparison = durationMs;
    },
    false,
  );
  startedAt = now();
  const coldGraph = coldScan(coldProject);
  const coldComparisonMs = round(now() - startedAt);

  return {
    schemaVersion: 1 as const,
    benchmark: "typescript-program-reuse" as const,
    projectPath,
    changedFile,
    environment: { node: process.version, platform: process.platform, arch: process.arch },
    initialScanMs,
    reusedScanMs,
    coldComparisonMs,
    compilerContextMs,
    equivalentGraph: graphValue(reusedGraph) === graphValue(coldGraph),
    graph: { nodes: reusedGraph.nodes.length, edges: reusedGraph.edges.length },
  };
};
