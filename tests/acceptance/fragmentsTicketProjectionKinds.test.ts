import { describe, expect, it } from "vitest";

import { projectDownstream } from "../../src/domain/graphProjection.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments Ticket projection node kinds", () => {
  it("keeps only Events and Handlers in a focused Ticket projection", async () => {
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

    const projection = projectDownstream(graph, "uiTicketSubmitRequested", {
      nodeKinds: ["Event", "Handler"],
    });

    expect(projection.nodes.every((node) => node.kind === "Event" || node.kind === "Handler")).toBe(
      true,
    );
    expect(projection.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "uiTicketSubmitRequested",
        "ticketSubmitUseCaseFactory",
        "ticketOptimisticCreated",
        "enqueueCommitted",
        "outboxProcessOnce",
      ]),
    );
    expect(projection.nodes.map((node) => node.id)).not.toContain("tState");
    expect(projection.nodes.map((node) => node.id)).not.toContain("TicketsWlGateway");
    expect(projection.edges).not.toContainEqual({
      source: "ticketOptimisticCreated",
      target: "tState",
      kind: "UPDATES",
    });
  }, 15_000);
});
