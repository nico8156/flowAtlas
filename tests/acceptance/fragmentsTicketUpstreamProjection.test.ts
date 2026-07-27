import { describe, expect, it } from "vitest";

import { projectUpstream } from "../../src/domain/graphProjection.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Ticket upstream projection", () => {
  it("shows the events and handlers that can lead to ticket state mutations", async () => {
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

    const projection = projectUpstream(graph, "tState");
    const projectedNodeIds = projection.nodes.map((node) => node.id);

    expect(projectedNodeIds).toEqual(
      expect.arrayContaining([
        "tState",
        "ticketOptimisticCreated",
        "ticketRetrieved",
        "ticketSubmitUseCaseFactory",
        "ticketRetrieval",
        "uiTicketSubmitRequested",
      ]),
    );
    expect(projectedNodeIds).not.toContain("outboxProcessOnce");
    expect(projection.edges).toEqual(
      expect.arrayContaining([
        {
          source: "ticketOptimisticCreated",
          target: "tState",
          kind: "UPDATES",
        },
        {
          source: "ticketRetrieved",
          target: "tState",
          kind: "UPDATES",
        },
        {
          source: "ticketSubmitUseCaseFactory",
          target: "uiTicketSubmitRequested",
          kind: "LISTENS_TO",
        },
      ]),
    );
  }, 15_000);
});
