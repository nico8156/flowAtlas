import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const context = "com/nm/fragmentsclean/experienceContext/write";
const controllerFile = `${context}/adapters/primary/springboot/controllers/WriteExperienceModerationController.java`;
const describeFragments = existsSync(join(fragmentsRoot, "src/main/java", controllerFile))
  ? describe
  : describe.skip;

describeFragments("Fragments moderation HTTP command route", () => {
  it("preserves the moderation projection when its full path moves to the method", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flowatlas-moderation-route-"));
    try {
      const controller =
        "com.nm.fragmentsclean.experienceContext.write.adapters.primary.springboot.controllers.WriteExperienceModerationController";
      const command =
        "com.nm.fragmentsclean.experienceContext.write.businesslogic.usecases.ModerateExperienceCommand";
      const handler = `${command}Handler`;
      const requestPath = join(directory, "request.json");
      await writeFile(
        requestPath,
        JSON.stringify({
          sourceRoot: "src/main/java",
          scanSources: [
            controllerFile,
            `${context}/businesslogic/usecases/ModerateExperienceCommandHandler.java`,
          ],
          resolutionSources: [`${context}/businesslogic/usecases/ModerateExperienceCommand.java`],
          command,
          commandMarker: "com.nm.fragmentsclean.sharedKernel.businesslogic.models.command.Command",
          commandHandlerInterface:
            "com.nm.fragmentsclean.sharedKernel.businesslogic.models.command.CommandHandler",
          commandHandler: handler,
          controller,
          controllerMethod: "moderate",
          requestMappingAnnotation: "org.springframework.web.bind.annotation.RequestMapping",
          httpMethodMappingAnnotation: "org.springframework.web.bind.annotation.PostMapping",
          httpMethod: "POST",
          commandBus: "com.nm.fragmentsclean.sharedKernel.adapters.primary.springboot.CommandBus",
          commandDispatchMethod: "dispatch",
        }),
      );
      const scanner = createJavaMavenArchitectureScanner();
      const original = await scanner.scan({ projectPath: fragmentsRoot, requestPath });
      await cp(join(fragmentsRoot, "pom.xml"), join(directory, "pom.xml"));
      await cp(join(fragmentsRoot, "src/main/java"), join(directory, "src/main/java"), {
        recursive: true,
      });
      const temporaryController = join(directory, "src/main/java", controllerFile);
      const source = await readFile(temporaryController, "utf8");
      expect(source).toContain('@RequestMapping("/api/admin")');
      await writeFile(
        temporaryController,
        source
          .replace('@RequestMapping("/api/admin")', "")
          .replace(/@PostMapping\("\//g, '@PostMapping("/api/admin/'),
      );
      const methodOnly = await scanner.scan({ projectPath: directory, requestPath });
      const topology = (graph: typeof original.graph) => ({
        nodes: graph.nodes.map(({ id, kind }) => ({ id, kind })),
        edges: graph.edges.map(({ source, target, kind }) => ({ source, target, kind })),
      });
      expect(topology(methodOnly.graph)).toEqual(topology(original.graph));
      expect(methodOnly.graph.nodes).toHaveLength(4);
      expect(methodOnly.graph.edges).toHaveLength(3);
      expect(methodOnly.graph.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: "protocol:http:POST:/api/admin/experiences/{experienceId}/moderation",
            kind: "LISTENS_TO",
          }),
          expect.objectContaining({ target: `java-command:${command}`, kind: "DISPATCHES" }),
          expect.objectContaining({
            source: handler,
            target: `java-command:${command}`,
            kind: "LISTENS_TO",
          }),
        ]),
      );
      expect(methodOnly.graph.nodes.some((node) => node.id.includes("CommandBus"))).toBe(false);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 120_000);
});
