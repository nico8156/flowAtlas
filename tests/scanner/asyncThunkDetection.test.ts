import { describe, expect, it } from "vitest";

import { scanTypeScriptSource } from "../../src/scanner/typeScriptScanner.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { readFixture } from "./fixtureSource.js";

describe("Redux async thunk detection", () => {
  it("maps a createAsyncThunk declaration to a Handler and lifecycle Events", async () => {
    const file = "tests/fixtures/asyncThunkLifecycle.ts";
    const source = await readFixture("asyncThunkLifecycle.ts");

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "login",
      kind: "Handler",
      sourceLocation: { file, line: 3 },
    });
    for (const lifecycle of ["pending", "fulfilled", "rejected"]) {
      expect(graph.nodes).toContainEqual({
        id: `login.${lifecycle}`,
        kind: "Event",
        sourceLocation: { file, line: 3 },
      });
      expect(graph.edges).toContainEqual({
        source: "login",
        target: `login.${lifecycle}`,
        kind: "DISPATCHES",
      });
    }
  });

  it("resolves a typed async thunk factory through its import", async () => {
    const files = [
      "tests/fixtures/typedAsyncThunkFactory.ts",
      "tests/fixtures/typedAsyncThunkUsage.ts",
    ];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFixture(file.split("/").pop() ?? ""),
        })),
      ),
    });

    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: "login", kind: "Handler" }));
    expect(graph.edges).toContainEqual({
      source: "login",
      target: "login.fulfilled",
      kind: "DISPATCHES",
    });
  });

  it("resolves a typed async thunk factory through a tsconfig path alias", async () => {
    const factorySource = await readFixture("typedAsyncThunkFactory.ts");
    const usageSource = (await readFixture("typedAsyncThunkUsage.ts")).replace(
      "./typedAsyncThunkFactory.js",
      "@/app/typedAsyncThunkFactory",
    );
    const graph = scanTypeScriptProject({
      files: [
        { file: "src/app/typedAsyncThunkFactory.ts", source: factorySource },
        { file: "src/features/auth/typedAsyncThunkUsage.ts", source: usageSource },
      ],
      tsconfig: {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["src/*"] },
        },
      },
    });

    expect(graph.nodes).toContainEqual(expect.objectContaining({ id: "login", kind: "Handler" }));
  });
});
