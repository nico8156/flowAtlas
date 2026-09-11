import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaHttpCommandGraph } from "../../src/scanner/javaHttpCommandDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const protocolEvent = "protocol:http:POST:/api/tickets/verify";
const commandEvent =
  "java-command:com.nm.fragmentsclean.ticketContext.write.businesslogic.usecases.VerifyTicketCommand";
const controllerHandler =
  "com.nm.fragmentsclean.ticketContext.write.adapters.primary.springboot.controllers.WriteTicketController#verify(com.nm.fragmentsclean.ticketContext.write.adapters.primary.springboot.controllers.TicketVerifyRequestDto,org.springframework.security.oauth2.jwt.Jwt,java.lang.String)";
const commandHandler =
  "com.nm.fragmentsclean.ticketContext.write.businesslogic.usecases.VerifyTicketCommandHandler";

describeFragments("Fragments Java HTTP command graph", () => {
  it("projects the protocol signal, dispatched command and typed command handler", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-http-command-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as Parameters<typeof detectJavaHttpCommandGraph>[0];
    const graph = detectJavaHttpCommandGraph(evidence);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: protocolEvent, kind: "Event" }),
        expect.objectContaining({ id: controllerHandler, kind: "Handler" }),
        expect.objectContaining({ id: commandEvent, kind: "Event" }),
        expect.objectContaining({ id: commandHandler, kind: "Handler" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        {
          source: controllerHandler,
          target: protocolEvent,
          kind: "LISTENS_TO",
          sourceLocation: expect.any(Object),
        },
        {
          source: controllerHandler,
          target: commandEvent,
          kind: "DISPATCHES",
          sourceLocation: expect.any(Object),
        },
        {
          source: commandHandler,
          target: commandEvent,
          kind: "LISTENS_TO",
          sourceLocation: expect.any(Object),
        },
      ]),
    );

    expect(graph.nodes.some((node) => node.id.includes("CommandBus"))).toBe(false);
    expect(
      graph.edges.some((edge) => edge.source === commandHandler && edge.kind === "DISPATCHES"),
    ).toBe(false);
  }, 60_000);
});
