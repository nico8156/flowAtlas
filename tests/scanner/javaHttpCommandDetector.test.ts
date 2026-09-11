import { describe, expect, it } from "vitest";

import { detectJavaHttpCommandGraph } from "../../src/scanner/javaHttpCommandDetector.js";

const commandType = "fixture.commands.VerifyTicketCommand";
const controllerHandler = "fixture.http.WriteTicketController#verify()";
const commandHandler = "fixture.application.VerifyTicketCommandHandler";

describe("Java HTTP command detector", () => {
  it("projects only typed commands, mapped endpoints and in-scope dispatches", () => {
    const graph = detectJavaHttpCommandGraph({
      command: {
        qualifiedName: commandType,
        assignableToCommand: true,
        source: { file: "fixture/commands/VerifyTicketCommand.java", line: 5, inScanScope: false },
      },
      commandHandler: {
        qualifiedName: commandHandler,
        commandType,
        source: {
          file: "fixture/application/VerifyTicketCommandHandler.java",
          line: 6,
          inScanScope: true,
        },
      },
      httpEndpoint: {
        controller: "fixture.http.WriteTicketController",
        handler: controllerHandler,
        httpMethod: "POST",
        path: "/api/tickets/verify",
        source: { file: "fixture/http/WriteTicketController.java", line: 15, inScanScope: true },
      },
      commandDispatches: [
        {
          owner: "fixture.infrastructure.CommandBus",
          method: "dispatch(fixture.shared.Command)",
          caller: controllerHandler,
          argumentType: commandType,
          source: { file: "fixture/http/WriteTicketController.java", line: 18, inScanScope: true },
        },
        {
          owner: "fixture.infrastructure.CommandBus",
          method: "dispatch(fixture.shared.Command)",
          caller: "fixture.http.OtherController#verify()",
          argumentType: commandType,
          source: { file: "fixture/http/OtherController.java", line: 10, inScanScope: false },
        },
      ],
    });

    expect(graph.nodes).toEqual([
      expect.objectContaining({ id: `java-command:${commandType}`, kind: "Event" }),
      expect.objectContaining({ id: commandHandler, kind: "Handler" }),
      expect.objectContaining({ id: "protocol:http:POST:/api/tickets/verify", kind: "Event" }),
      expect.objectContaining({ id: controllerHandler, kind: "Handler" }),
    ]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: commandHandler,
        target: `java-command:${commandType}`,
        kind: "LISTENS_TO",
      }),
      expect.objectContaining({
        source: controllerHandler,
        target: "protocol:http:POST:/api/tickets/verify",
        kind: "LISTENS_TO",
      }),
      expect.objectContaining({
        source: controllerHandler,
        target: `java-command:${commandType}`,
        kind: "DISPATCHES",
      }),
    ]);
    expect(graph.nodes.some((node) => node.id.includes("CommandBus"))).toBe(false);
  });
});
