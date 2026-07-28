import { describe, expect, it } from "vitest";

import { projectDownstream } from "../../src/domain/graphProjection.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Ticket projection depth", () => {
  it("limits the focused Ticket territory without changing the architecture graph", async () => {
    const files = [
      "app/core-logic/contextWL/ticketWl/usecases/write/ticketSubmitWlUseCase.ts",
      "app/core-logic/contextWL/ticketWl/reducer/ticketWl.reducer.ts",
      "app/core-logic/contextWL/ticketWl/gateway/ticketWl.gateway.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.actions.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.type.ts",
      "app/core-logic/contextWL/outboxWl/reducer/outboxWl.reducer.ts",
      "app/core-logic/contextWL/outboxWl/processOutbox.ts",
      "app/core-logic/contextWL/outboxWl/commandHandlers/outboxCommandHandlers.ts",
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

    const projection = projectDownstream(graph, "uiTicketSubmitRequested", { maxDepth: 2 });
    const projectedNodeIds = projection.nodes.map((node) => node.id);

    expect(projectedNodeIds).toEqual(
      expect.arrayContaining([
        "uiTicketSubmitRequested",
        "ticketSubmitUseCaseFactory",
        "ticketOptimisticCreated",
        "enqueueCommitted",
        "outboxProcessOnce",
      ]),
    );
    expect(projectedNodeIds).not.toContain("tState");
    expect(projectedNodeIds).not.toContain("TicketsWlGateway");
    expect(Array.from(graph.nodes)).toEqual(expect.arrayContaining(Array.from(projection.nodes)));
    expect(Array.from(graph.edges)).toEqual(expect.arrayContaining(Array.from(projection.edges)));
  }, 15_000);
});
