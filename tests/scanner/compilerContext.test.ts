import { describe, expect, it } from "vitest";

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
});
