import { describe, expect, it } from "vitest";

import { projectDownstream } from "../../src/domain/graphProjection.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import {
  createViewport,
  layoutProjection,
  panViewport,
  type Density,
} from "../../src/tui/terminalMapLayout.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

const scanTicketGraph = async () => {
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

  return scanTypeScriptProject({
    tsconfig,
    files: await Promise.all(
      files.map(async (file) => ({ file, source: await readFragment(file) })),
    ),
    projectFiles: await readFragmentProjectSources(),
  });
};

const nodeIds = (nodes: readonly { id: string }[]): string[] => nodes.map((node) => node.id);

describeFragments("Fragments terminal map acceptance", () => {
  it("lays out a real Ticket territory without changing its graph semantics", async () => {
    const graph = await scanTicketGraph();
    const projection = projectDownstream(graph, "uiTicketSubmitRequested");
    const densities: readonly Density[] = ["compact", "normal", "detailed"];
    const layouts = densities.map((density) => layoutProjection(projection, { density }));

    for (const layout of layouts) {
      expect(nodeIds(layout.nodes)).toEqual(nodeIds(projection.nodes));
      expect(layout.edges).toEqual(projection.edges);
      expect(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size).toBe(
        layout.nodes.length,
      );
    }

    expect(layouts[0]?.nodes).not.toEqual(layouts[2]?.nodes);

    const viewport = createViewport(60, 20);
    const panned = panViewport(viewport, { x: 12, y: 5 });

    expect(panned).toEqual({ x: 12, y: 5, width: 60, height: 20 });
    expect(viewport).toEqual({ x: 0, y: 0, width: 60, height: 20 });
  }, 20_000);
});
