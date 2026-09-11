import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");
const requestPath = resolve(fixtureRoot, "flowatlas-java-integration-event-request.json");

describe("Java integration-event semantic context", () => {
  it("resolves outbox identities, the sender pipeline and configured SQS consumers", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/javaMavenSemanticContext.mjs", fixtureRoot, requestPath],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as {
      integrationEventMappings: Array<Record<string, unknown>>;
      integrationEventConsumers: Array<Record<string, unknown>>;
    };

    expect(evidence.integrationEventMappings).toEqual([
      expect.objectContaining({
        producerEvent: "fixture.events.TicketVerifyAcceptedEvent",
        aggregateType: "Ticket",
        destination: "ticket-events",
        eventType: "ticket.verify.accepted",
        version: 1,
        sender:
          "fixture.integration.StableEnvelopeOutboxEventSender#send(fixture.integration.OutboxEvent)",
      }),
      expect.objectContaining({
        destination: "ticket-verification-requested",
        eventType: "ticket.verify.accepted",
        version: 1,
      }),
    ]);
    expect(evidence.integrationEventConsumers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          handler:
            "fixture.integration.TicketSqsIntegrationEventHandlers#ticketReadHandler(fixture.integration.TicketReadHandler)",
          destination: "ticket-events",
          eventType: "ticket.verify.accepted",
        }),
        expect.objectContaining({
          handler:
            "fixture.integration.TicketSqsIntegrationEventHandlers#verificationHandler(fixture.application.TicketVerificationProcessManager)",
          destination: "ticket-verification-requested",
          eventType: "ticket.verify.accepted",
        }),
      ]),
    );
  }, 30_000);
});
