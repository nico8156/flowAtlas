import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Ticket verification acceptance", () => {
  it("reconstructs the verification and status branches without inventing Handler relations", async () => {
    const files = [
      "app/core-logic/contextWL/ticketWl/usecases/write/ticketSubmitWlUseCase.ts",
      "app/core-logic/contextWL/ticketWl/usecases/read/ticketRetrieval.ts",
      "app/core-logic/contextWL/ticketWl/reducer/ticketWl.reducer.ts",
      "app/core-logic/contextWL/ticketWl/gateway/ticketWl.gateway.ts",
      "app/core-logic/contextWL/ticketWl/typeAction/ticket.type.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.actions.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.type.ts",
      "app/core-logic/contextWL/outboxWl/reducer/outboxWl.reducer.ts",
      "app/core-logic/contextWL/outboxWl/processOutbox.ts",
      "app/core-logic/contextWL/outboxWl/commandHandlers/outboxCommandHandlers.ts",
      "app/core-logic/contextWL/projectionSyncWl/usecases/projectionSyncListenerFactory.ts",
      "app/core-logic/contextWL/projectionSyncWl/typeAction/projectionSync.action.ts",
      "app/core-logic/contextWL/projectionSyncWl/gateway/projectionSync.gateway.ts",
      "app/core-logic/contextWL/userWl/typeAction/user.action.ts",
      "app/core-logic/contextWL/appWl/typeAction/appWl.action.ts",
      "app/store/reduxStoreWl.ts",
    ];
    const tsconfig = JSON.parse(await readFragment("tsconfig.json")) as {
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
      };
    };
    const graph = scanTypeScriptProject({
      tsconfig,
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFragment(file),
        })),
      ),
      projectFiles: await readFragmentProjectSources(),
    });

    const relevantNodeIds = new Set([
      "uiTicketSubmitRequested",
      "ticketSubmitUseCaseFactory",
      "ticketOptimisticCreated",
      "enqueueCommitted",
      "outboxProcessOnce",
      "processOutboxFactory",
      "TicketsWlGateway",
      "projection.updated",
      "projectionSyncListenerFactory",
      "ticketRetrieval",
      "ticketRetrieved",
      "tState",
      "oState",
    ]);
    const relevantEdges = graph.edges.filter(
      (edge) => relevantNodeIds.has(edge.source) || relevantNodeIds.has(edge.target),
    );
    const relevantNodes = graph.nodes
      .filter((node) => relevantNodeIds.has(node.id))
      .map(({ id, kind }) => ({ id, kind }));

    expect(relevantNodes).toEqual(
      expect.arrayContaining([
        { id: "uiTicketSubmitRequested", kind: "Event" },
        { id: "ticketSubmitUseCaseFactory", kind: "Handler" },
        { id: "ticketOptimisticCreated", kind: "Event" },
        { id: "enqueueCommitted", kind: "Event" },
        { id: "outboxProcessOnce", kind: "Event" },
        { id: "processOutboxFactory", kind: "Handler" },
        { id: "TicketsWlGateway", kind: "External" },
        { id: "projection.updated", kind: "Event" },
        { id: "projectionSyncListenerFactory", kind: "Handler" },
        { id: "ticketRetrieval", kind: "Handler" },
        { id: "ticketRetrieved", kind: "Event" },
        { id: "tState", kind: "State" },
        { id: "oState", kind: "State" },
      ]),
    );
    expect(graph.findNode("projection.updated")).toEqual(
      expect.objectContaining({ source: "external-protocol" }),
    );
    expect(relevantEdges).toEqual(
      expect.arrayContaining([
        {
          source: "ticketSubmitUseCaseFactory",
          target: "uiTicketSubmitRequested",
          kind: "LISTENS_TO",
        },
        {
          source: "ticketSubmitUseCaseFactory",
          target: "ticketOptimisticCreated",
          kind: "DISPATCHES",
        },
        {
          source: "ticketSubmitUseCaseFactory",
          target: "enqueueCommitted",
          kind: "DISPATCHES",
        },
        {
          source: "ticketSubmitUseCaseFactory",
          target: "outboxProcessOnce",
          kind: "DISPATCHES",
        },
        {
          source: "ticketOptimisticCreated",
          target: "tState",
          kind: "UPDATES",
        },
        {
          source: "enqueueCommitted",
          target: "oState",
          kind: "UPDATES",
        },
        {
          source: "processOutboxFactory",
          target: "outboxProcessOnce",
          kind: "LISTENS_TO",
        },
        {
          source: "processOutboxFactory",
          target: "TicketsWlGateway",
          kind: "CALLS_EXTERNAL",
        },
        {
          source: "projectionSyncListenerFactory",
          target: "projection.updated",
          kind: "LISTENS_TO",
        },
        {
          source: "ticketRetrieval",
          target: "TicketsWlGateway",
          kind: "CALLS_EXTERNAL",
        },
        {
          source: "ticketRetrieval",
          target: "ticketRetrieved",
          kind: "DISPATCHES",
        },
        {
          source: "ticketRetrieved",
          target: "tState",
          kind: "UPDATES",
        },
      ]),
    );
    expect(graph.edges).not.toContainEqual({
      source: "projectionSyncListenerFactory",
      target: "ticketRetrieval",
      kind: "DISPATCHES",
    });
  }, 15_000);
});
