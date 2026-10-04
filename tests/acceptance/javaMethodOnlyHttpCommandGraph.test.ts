import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { createJavaMavenArchitectureScanner } from "../../src/scanner/javaMavenArchitectureScanner.js";

const fixtureRoot = resolve(import.meta.dirname, "../fixtures/java-semantic-project");

const scanController = async (controller: string, controllerMethod = "verify") => {
  const directory = await mkdtemp(join(tmpdir(), "flowatlas-method-route-"));
  try {
    const request = JSON.parse(
      await readFile(join(fixtureRoot, "flowatlas-java-http-command-request.json"), "utf8"),
    );
    request.controller = `fixture.http.${controller}`;
    request.controllerMethod = controllerMethod;
    request.scanSources[1] = `fixture/http/${controller}.java`;
    const requestPath = join(directory, "request.json");
    await writeFile(requestPath, JSON.stringify(request));
    return await createJavaMavenArchitectureScanner().scan({
      projectPath: fixtureRoot,
      requestPath,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

describe("Java method-only HTTP command routes", () => {
  it("projects a full method path without a class mapping", async () => {
    const { graph } = await scanController("MethodOnlyTicketController");
    const controller = "fixture.http.MethodOnlyTicketController#verify()";
    const command = "java-command:fixture.commands.VerifyTicketCommand";
    expect(graph.nodes.map(({ id, kind }) => ({ id, kind }))).toEqual(
      expect.arrayContaining([
        { id: "protocol:http:POST:/api/tickets/verify", kind: "Event" },
        { id: controller, kind: "Handler" },
        { id: command, kind: "Event" },
        { id: "fixture.application.VerifyTicketCommandHandler", kind: "Handler" },
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: controller,
          target: "protocol:http:POST:/api/tickets/verify",
          kind: "LISTENS_TO",
        }),
        expect.objectContaining({ source: controller, target: command, kind: "DISPATCHES" }),
        expect.objectContaining({
          source: "fixture.application.VerifyTicketCommandHandler",
          target: command,
          kind: "LISTENS_TO",
        }),
      ]),
    );
    expect(graph.nodes.some((node) => node.id.includes("CommandBus"))).toBe(false);
  }, 30_000);

  it("preserves composition of class and method paths", async () => {
    const { graph } = await scanController("WriteTicketController");
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: "fixture.http.WriteTicketController#verify()",
        target: "protocol:http:POST:/api/tickets/verify",
        kind: "LISTENS_TO",
      }),
    );
    expect(graph.nodes.some((node) => node.id === "protocol:http:POST:/verify")).toBe(false);
  }, 30_000);

  it("rejects a method without the configured HTTP mapping", async () => {
    await expect(scanController("MethodOnlyTicketController", "unmapped")).rejects.toThrow(
      "Could not resolve configured HTTP mapping annotations",
    );
  }, 30_000);
});
