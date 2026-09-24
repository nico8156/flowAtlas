import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");
const requestPath = resolve(repositoryRoot, "tests/fixtures/java-multi-projection-request.json");

describe("Java Maven project discovery", () => {
  it("resolves a unique backend/pom.xml from a Git root", async () => {
    const monorepoRoot = await mkdtemp(join(tmpdir(), "flowatlas-maven-monorepo-"));
    try {
      await execFileAsync("git", ["init", "--quiet"], { cwd: monorepoRoot });
      await cp(fixtureRoot, join(monorepoRoot, "backend"), { recursive: true });

      const { graph } = await createJavaMavenArchitectureScanner().scan({
        projectPath: monorepoRoot,
        requestPath,
      });

      expect(graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: "dailyWalkGoal", kind: "UPDATES" }),
          expect.objectContaining({ target: "dailyWalkProgress", kind: "UPDATES" }),
        ]),
      );
    } finally {
      await rm(monorepoRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it("asks for an explicit module when a Git root has multiple Maven candidates", async () => {
    const monorepoRoot = await mkdtemp(join(tmpdir(), "flowatlas-maven-ambiguous-"));
    try {
      await execFileAsync("git", ["init", "--quiet"], { cwd: monorepoRoot });
      for (const module of ["backend", "tools"]) {
        const moduleRoot = join(monorepoRoot, module);
        await mkdir(moduleRoot);
        await writeFile(join(moduleRoot, "pom.xml"), "<project />");
      }

      await expect(
        createJavaMavenArchitectureScanner().scan({
          projectPath: monorepoRoot,
          requestPath,
        }),
      ).rejects.toThrow(
        /multiple direct Maven modules found: backend, tools.*pass the intended module/u,
      );
    } finally {
      await rm(monorepoRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
