import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaIntegrationEventGraph } from "../../src/scanner/javaIntegrationEventDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fragmentsRoot = resolve(process.env.FLOWATLAS_FRAGMENTS_BACKEND_ROOT ?? "../fragmentsClean");
const fragmentsAvailable = existsSync(resolve(fragmentsRoot, "pom.xml"));
const describeFragments = fragmentsAvailable ? describe : describe.skip;

const domainEvent =
  "java-domain-event:com.nm.fragmentsclean.ticketContext.write.businesslogic.models.TicketVerifyAcceptedEvent";
const ticketEvents = "integration:ticket-events:ticket.verify.accepted:v1";
const verificationRequests = "integration:ticket-verification-requested:ticket.verify.accepted:v1";
const sender =
  "com.nm.fragmentsclean.platform.eventing.StableEnvelopeOutboxEventSender#send(com.nm.fragmentsclean.sharedKernel.businesslogic.eventing.OutboxMessage)";
const readConsumer =
  "com.nm.fragmentsclean.ticketContext.read.adapters.primary.springboot.sqs.TicketSqsIntegrationEventHandlers#ticketVerifyAcceptedReadSqsIntegrationEventHandler(com.nm.fragmentsclean.ticketContext.read.projections.TicketVerifyAcceptedEventHandler,com.nm.fragmentsclean.sharedKernel.businesslogic.privacy.AccountErasureBarrier)";
const verificationConsumer =
  "com.nm.fragmentsclean.ticketContext.read.adapters.primary.springboot.sqs.TicketSqsIntegrationEventHandlers#ticketVerificationRequestedSqsIntegrationEventHandler(com.nm.fragmentsclean.ticketContext.write.businesslogic.processManagers.TicketVerificationProcessManager,com.nm.fragmentsclean.sharedKernel.businesslogic.privacy.AccountErasureBarrier)";

describeFragments("Fragments Java integration-event graph", () => {
  it("projects destination-specific identities and their statically configured consumers", async () => {
    const { stdout } = await execFileAsync(
      "node",
      [
        "scripts/javaMavenSemanticContext.mjs",
        fragmentsRoot,
        resolve(repositoryRoot, "tests/fixtures/fragments-java-integration-event-request.json"),
      ],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const evidence = JSON.parse(stdout) as Parameters<typeof detectJavaIntegrationEventGraph>[0];
    const graph = detectJavaIntegrationEventGraph(evidence);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ticketEvents, kind: "Event" }),
        expect.objectContaining({ id: verificationRequests, kind: "Event" }),
        expect.objectContaining({ id: sender, kind: "Handler" }),
        expect.objectContaining({ id: readConsumer, kind: "Handler" }),
        expect.objectContaining({ id: verificationConsumer, kind: "Handler" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: sender, target: ticketEvents, kind: "DISPATCHES" }),
        expect.objectContaining({
          source: sender,
          target: verificationRequests,
          kind: "DISPATCHES",
        }),
        expect.objectContaining({ source: readConsumer, target: ticketEvents, kind: "LISTENS_TO" }),
        expect.objectContaining({
          source: verificationConsumer,
          target: verificationRequests,
          kind: "LISTENS_TO",
        }),
      ]),
    );

    expect(graph.findNode(domainEvent)).toBeUndefined();
    expect(
      graph.nodes.some((node) =>
        /OutboxDomainEventPublisher|SqsIntegrationEventRouter|InboxMessageRepository|IntegrationMessagePublisher/u.test(
          node.id,
        ),
      ),
    ).toBe(false);
    expect(graph.edges.some((edge) => edge.kind === "CALLS_EXTERNAL")).toBe(false);
  }, 60_000);
});
