import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { resolveProjectSymbols } from "../../src/scanner/projectSymbolResolver.js";

describe("compiler context", () => {
  it("shares the Program SourceFile with project symbol resolution", () => {
    const resolution = resolveProjectSymbols({
      files: [
        {
          file: "src/actions.ts",
          source: `export const requested = createAction("REQUESTED");`,
        },
      ],
    });

    const source = resolution.sourceFiles[0];
    if (!source) throw new Error("expected a compiled source file");
    const compiledSource = resolution.program.getSourceFile("src/actions.ts");

    expect(resolution.program).toBeDefined();
    expect(resolution.checker).toBeDefined();
    expect(compiledSource).toBe(source.sourceFile);
  });

  it("reports scan phases without changing the produced graph", () => {
    const phases: string[] = [];

    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/actions.ts",
          source: `export const requested = createAction("REQUESTED");`,
        },
      ],
      onScanPhase: ({ phase, durationMs }) => {
        phases.push(phase);
        expect(durationMs).toBeGreaterThanOrEqual(0);
      },
    });

    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: "requested", kind: "Event" }));
    expect(phases).toEqual([
      "compiler-context",
      "event-identities",
      "semantic-index",
      "import-bindings",
      "state-discovery",
      "discovery-pass",
      "relationship-external-detection",
      "relationship-event-detection",
      "relationship-listener-detection",
      "relationship-state-detection",
      "listener-discovery",
      "listener-infrastructure",
      "listener-dispatch",
      "listener-external",
      "listener-thunk",
      "relationship-pass",
    ]);
  });

  it("reuses unchanged compiler sources while replacing a modified source", () => {
    const firstProject = {
      files: [
        { file: "src/unchanged.ts", source: `export const unchanged = true;` },
        { file: "src/changed.ts", source: `export const requested = createAction("REQUESTED");` },
      ],
    };
    const first = resolveProjectSymbols(firstProject);
    const second = resolveProjectSymbols(
      {
        files: [
          firstProject.files[0]!,
          { file: "src/changed.ts", source: `export const succeeded = createAction("SUCCEEDED");` },
        ],
      },
      first.program,
    );

    expect(second.program).not.toBe(first.program);
    expect(second.program.getSourceFile("src/unchanged.ts")).toBe(
      first.program.getSourceFile("src/unchanged.ts"),
    );
    expect(second.program.getSourceFile("src/changed.ts")).not.toBe(
      first.program.getSourceFile("src/changed.ts"),
    );
  });
});
