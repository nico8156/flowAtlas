import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../../src/cli.js";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;
const execFileAsync = promisify(execFile);

describeFragments("Java CLI JSON export", () => {
  afterEach(() => vi.restoreAllMocks());

  it("scans an explicit Maven project and request without changing the TypeScript default", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "scan",
      "--adapter",
      "java",
      "--request",
      resolve(repositoryRoot, "tests/fixtures/fragments-java-external-request.json"),
      fragmentsRoot,
      "--json",
    ]);

    const graph = JSON.parse(String(write.mock.calls[0]?.[0] ?? "")) as {
      nodes: Array<{ id: string; kind: string }>;
      edges: Array<{ source: string; target: string; kind: string }>;
    };
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "local-process:java.lang.ProcessBuilder", kind: "External" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "local-process:java.lang.ProcessBuilder",
          kind: "CALLS_EXTERNAL",
        }),
      ]),
    );
  }, 60_000);

  it("keeps the Java semantic script discoverable from the compiled CLI", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        resolve(repositoryRoot, "dist/index.js"),
        "scan",
        "--adapter",
        "java",
        "--request",
        resolve(repositoryRoot, "tests/fixtures/fragments-java-external-request.json"),
        fragmentsRoot,
        "--json",
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );

    expect(JSON.parse(stdout).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "local-process:java.lang.ProcessBuilder", kind: "External" }),
      ]),
    );
  }, 60_000);
});
