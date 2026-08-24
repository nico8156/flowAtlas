import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { projectDownstream, projectUpstream } from "../../src/domain/graphProjection.js";
import { projectFocusedTerritory } from "../../src/application/focusedGraphProjection.js";
import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { TerminalTui } from "../../src/tui/TerminalTui.js";
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

const nextFrame = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 80));
};

describeFragments("Fragments terminal projection navigation acceptance", () => {
  it("uses the existing focus, upstream and downstream projections", async () => {
    const graph = await scanTicketGraph();
    const rootNodeId = "uiTicketSubmitRequested";
    const instance = render(
      <TerminalTui
        initialSelectedNodeId={rootNodeId}
        projection={{ nodes: graph.nodes, edges: graph.edges }}
        projectDownstream={(nodeId) => ({
          mode: "downstream",
          projection: projectDownstream(graph, nodeId),
          rootNodeId: nodeId,
        })}
        projectFocus={(nodeId) => ({
          mode: "focus",
          projection: projectFocusedTerritory(graph, nodeId),
          rootNodeId: nodeId,
        })}
        projectUpstream={(nodeId) => ({
          mode: "upstream",
          projection: projectUpstream(graph, nodeId),
          rootNodeId: nodeId,
        })}
      />,
    );

    expect(instance.lastFrame()).toContain("FULL");

    instance.stdin.write("d");
    await nextFrame();
    expect(instance.lastFrame()).toContain("DOWNSTREAM · uiTicketSubmitRequested");
    expect(instance.lastFrame()).toContain(rootNodeId);

    instance.stdin.write("f");
    await nextFrame();
    expect(instance.lastFrame()).toContain("FOCUS · uiTicketSubmitRequested");

    instance.stdin.write("\u001b");
    await nextFrame();
    expect(instance.lastFrame()).toContain("DOWNSTREAM · uiTicketSubmitRequested");

    instance.stdin.write("\u001b");
    await nextFrame();
    expect(instance.lastFrame()).toContain("FULL");

    instance.stdin.write("u");
    await nextFrame();
    expect(instance.lastFrame()).toContain("UPSTREAM · uiTicketSubmitRequested");

    instance.stdin.write("\t");
    instance.stdin.write("\t");
    await nextFrame();
    instance.stdin.write("2");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Kinds: E S X · 0 all");

    instance.stdin.write("0");
    await nextFrame();
    expect(instance.lastFrame()).toContain("Kinds: E H S X");

    instance.stdin.write("q");
    await nextFrame();
    instance.cleanup();
  }, 30_000);
});
