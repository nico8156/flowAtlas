import { describe, expect, it } from "vitest";

import { createProgramReusingProjectScanner } from "../../src/mcp/programReusingProjectScanner.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";

describe("program-reusing project scanner", () => {
  it("rebuilds the complete graph with a reused compiler program", () => {
    const reuse: boolean[] = [];
    const scanProject = createProgramReusingProjectScanner({
      maxPrograms: 2,
      onScan: ({ reusedProgram }) => reuse.push(reusedProgram),
    });
    const firstProject = {
      files: [
        { file: "src/unchanged.ts", source: `export const unchanged = true;` },
        { file: "src/event.ts", source: `export const requested = createAction("REQUESTED");` },
        { file: "src/deleted.ts", source: `export const deleted = createAction("DELETED");` },
      ],
      tsconfig: { compilerOptions: { baseUrl: "." } },
    };
    const changedProject = {
      ...firstProject,
      files: [
        firstProject.files[0]!,
        { file: "src/event.ts", source: `export const succeeded = createAction("SUCCEEDED");` },
        { file: "src/created.ts", source: `export const created = createAction("CREATED");` },
      ],
    };

    scanProject(firstProject, "/workspace/project");
    const reusedGraph = scanProject(changedProject, "/workspace/project");
    const coldGraph = scanTypeScriptProject(changedProject);

    expect(reuse).toEqual([false, true]);
    expect(reusedGraph.nodes).toEqual(coldGraph.nodes);
    expect(reusedGraph.edges).toEqual(coldGraph.edges);
  });

  it("starts a cold compiler context after a tsconfig change", () => {
    const reuse: boolean[] = [];
    const scanProject = createProgramReusingProjectScanner({
      maxPrograms: 1,
      onScan: ({ reusedProgram }) => reuse.push(reusedProgram),
    });
    const project = {
      files: [
        { file: "src/event.ts", source: `export const requested = createAction("REQUESTED");` },
      ],
      tsconfig: { compilerOptions: { baseUrl: "." } },
    };

    scanProject(project, "/workspace/project");
    scanProject(
      { ...project, tsconfig: { compilerOptions: { baseUrl: "src" } } },
      "/workspace/project",
    );

    expect(reuse).toEqual([false, false]);
  });
});
