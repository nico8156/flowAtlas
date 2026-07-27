import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments outbox acceptance", () => {
  it("reconstructs the outbox slice of the Like flow", async () => {
    const files = [
      "app/core-logic/contextWL/likeWl/usecases/write/likePressedUseCase.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.actions.ts",
      "app/core-logic/contextWL/outboxWl/reducer/outboxWl.reducer.ts",
      "app/core-logic/contextWL/outboxWl/processOutbox.ts",
      "app/core-logic/contextWL/outboxWl/commandHandlers/outboxCommandHandlers.ts",
      "app/core-logic/contextWL/likeWl/gateway/likeWl.gateway.ts",
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
    });

    const relevantNodeIds = new Set([
      "likeToggleUseCaseFactory",
      "enqueueCommitted",
      "oState",
      "outboxProcessOnce",
      "processOutboxFactory",
      "LikeWlGateway",
    ]);
    const actual = {
      nodes: graph.nodes
        .filter((node) => relevantNodeIds.has(node.id))
        .map(({ id, kind }) => ({ id, kind })),
      edges: graph.edges.filter(
        (edge) => relevantNodeIds.has(edge.source) || relevantNodeIds.has(edge.target),
      ),
    };

    expect(actual.nodes).toEqual(
      expect.arrayContaining([
        { id: "likeToggleUseCaseFactory", kind: "Handler" },
        { id: "enqueueCommitted", kind: "Event" },
        { id: "oState", kind: "State" },
        { id: "outboxProcessOnce", kind: "Event" },
        { id: "processOutboxFactory", kind: "Handler" },
        { id: "LikeWlGateway", kind: "External" },
      ]),
    );
    expect(actual.edges).toEqual(
      expect.arrayContaining([
        {
          source: "likeToggleUseCaseFactory",
          target: "enqueueCommitted",
          kind: "DISPATCHES",
        },
        {
          source: "enqueueCommitted",
          target: "oState",
          kind: "UPDATES",
        },
        {
          source: "likeToggleUseCaseFactory",
          target: "outboxProcessOnce",
          kind: "DISPATCHES",
        },
        {
          source: "processOutboxFactory",
          target: "outboxProcessOnce",
          kind: "LISTENS_TO",
        },
        {
          source: "processOutboxFactory",
          target: "LikeWlGateway",
          kind: "CALLS_EXTERNAL",
        },
      ]),
    );
  });
});
