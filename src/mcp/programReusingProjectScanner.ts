import type * as ts from "typescript";

import type { ArchitectureGraph } from "../domain/architectureGraph.js";
import type { TypeScriptProject } from "../scanner/projectSymbolResolver.js";
import { scanTypeScriptProject } from "../scanner/typeScriptScanner.js";

type ProgramSnapshot = {
  configFingerprint: string;
  program: ts.Program;
};

type ProgramReusingProjectScannerOptions = {
  maxPrograms: number;
  onScan?: (result: { projectRoot: string; reusedProgram: boolean }) => void;
};

const fingerprintCompilerConfiguration = (project: TypeScriptProject): string =>
  JSON.stringify(project.tsconfig ?? null);

export const createProgramReusingProjectScanner = ({
  maxPrograms,
  onScan,
}: ProgramReusingProjectScannerOptions): ((
  project: TypeScriptProject,
  projectRoot: string,
) => ArchitectureGraph) => {
  if (!Number.isInteger(maxPrograms) || maxPrograms < 1) {
    throw new Error("Compiler program capacity must be a positive integer.");
  }
  const programsByProjectRoot = new Map<string, ProgramSnapshot>();

  return (project, projectRoot) => {
    const configFingerprint = fingerprintCompilerConfiguration(project);
    const snapshot = programsByProjectRoot.get(projectRoot);
    const oldProgram =
      snapshot?.configFingerprint === configFingerprint ? snapshot.program : undefined;
    let program: ts.Program | undefined;
    const graph = scanTypeScriptProject(project, {
      ...(oldProgram ? { oldProgram } : {}),
      onProgramBuilt: (builtProgram) => {
        program = builtProgram;
      },
    });

    if (program) {
      programsByProjectRoot.delete(projectRoot);
      programsByProjectRoot.set(projectRoot, { configFingerprint, program });
      while (programsByProjectRoot.size > maxPrograms) {
        const leastRecentlyUsedRoot = programsByProjectRoot.keys().next().value as
          string | undefined;
        if (leastRecentlyUsedRoot === undefined) break;
        programsByProjectRoot.delete(leastRecentlyUsedRoot);
      }
    }
    onScan?.({ projectRoot, reusedProgram: oldProgram !== undefined });
    return graph;
  };
};
