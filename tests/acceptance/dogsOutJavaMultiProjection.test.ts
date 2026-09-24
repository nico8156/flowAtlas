import { existsSync } from "node:fs";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const dogsOutBackend = resolve(process.env.FLOWATLAS_DOGS_OUT_BACKEND_ROOT ?? "../dogsout/backend");
const dogsOutRequest = resolve(
  dogsOutBackend,
  "../.flowatlas/requests/daily-walk-progress-m8-1.json",
);
const describeDogsOut =
  existsSync(resolve(dogsOutBackend, "pom.xml")) && existsSync(dogsOutRequest)
    ? describe
    : describe.skip;

describeDogsOut("Dogs Out DailyWalkGoal multi-projection", () => {
  it("maps both read models updated by DailyWalkGoalConfiguredProjectionHandler", async () => {
    const request = JSON.parse(await readFile(dogsOutRequest, "utf8")) as Record<string, unknown>;
    delete request.projectionRepository;
    delete request.projectionMutationMethod;
    delete request.projectionState;
    request.projectionMutations = [
      {
        repository: "com.nm.dogsout.walkgoal.application.projectgoal.SaveDailyWalkGoalViewPort",
        method: "upsert",
        state: "DailyWalkGoal",
      },
      {
        repository: "com.nm.dogsout.walkgoal.application.projectgoal.ReplaceDailyWalkProgressPort",
        method: "replace",
        state: "DailyWalkProgress",
      },
    ];

    const directory = await mkdtemp(join(tmpdir(), "flowatlas-dogsout-multi-projection-"));
    const requestPath = join(directory, "daily-walk-progress.json");
    try {
      await writeFile(requestPath, JSON.stringify(request));
      const { graph, diagnostics } = await createJavaMavenArchitectureScanner().scan({
        projectPath: dogsOutBackend,
        requestPath,
      });

      expect(graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: "java-domain-event:com.nm.dogsout.walkgoal.domain.DailyWalkGoalConfigured",
            target: "DailyWalkGoal",
            kind: "UPDATES",
          }),
          expect.objectContaining({
            source: "java-domain-event:com.nm.dogsout.walkgoal.domain.DailyWalkGoalConfigured",
            target: "DailyWalkProgress",
            kind: "UPDATES",
          }),
        ]),
      );
      expect(diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
