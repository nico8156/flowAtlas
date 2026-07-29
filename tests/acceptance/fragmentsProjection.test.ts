import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments projection Like acceptance", () => {
  it("reconstructs the projection refresh branch without inventing Handler relations", async () => {
    const files = [
      "app/core-logic/contextWL/projectionSyncWl/usecases/projectionSyncListenerFactory.ts",
      "app/core-logic/contextWL/projectionSyncWl/gateway/projectionSync.gateway.ts",
      "app/core-logic/contextWL/projectionSyncWl/typeAction/projectionSync.action.ts",
      "app/core-logic/contextWL/userWl/typeAction/user.action.ts",
      "app/core-logic/contextWL/appWl/typeAction/appWl.action.ts",
      "app/core-logic/contextWL/likeWl/usecases/read/likeRetrieval.ts",
      "app/core-logic/contextWL/likeWl/typeAction/likeWl.action.ts",
      "app/core-logic/contextWL/likeWl/reducer/likeWl.reducer.ts",
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
      projectFiles: await readFragmentProjectSources(),
    });

    const relevantNodeIds = new Set([
      "projection.updated",
      "projectionSyncListenerFactory",
      "likesRetrieval",
      "LikeWlGateway",
      "likesRetrievalPending",
      "likesRetrieved",
      "likesRetrievalFailed",
      "lState",
    ]);
    const relevantEdges = graph.edges.filter(
      (edge) => relevantNodeIds.has(edge.source) || relevantNodeIds.has(edge.target),
    );
    const relevantNodes = graph.nodes
      .filter((node) => relevantNodeIds.has(node.id))
      .map(({ id, kind }) => ({ id, kind }));

    expect(relevantNodes).toEqual(
      expect.arrayContaining([
        { id: "projection.updated", kind: "Event" },
        { id: "projectionSyncListenerFactory", kind: "Handler" },
        { id: "likesRetrieval", kind: "Handler" },
        { id: "LikeWlGateway", kind: "External" },
        { id: "likesRetrievalPending", kind: "Event" },
        { id: "likesRetrieved", kind: "Event" },
        { id: "likesRetrievalFailed", kind: "Event" },
        { id: "lState", kind: "State" },
      ]),
    );
    expect(graph.findNode("projection.updated")).toEqual(
      expect.objectContaining({ source: "external-protocol" }),
    );
    expect(relevantEdges).toEqual(
      expect.arrayContaining([
        {
          source: "projectionSyncListenerFactory",
          target: "projection.updated",
          kind: "LISTENS_TO",
        },
        {
          source: "likesRetrieval",
          target: "LikeWlGateway",
          kind: "CALLS_EXTERNAL",
        },
        {
          source: "likesRetrieval",
          target: "likesRetrievalPending",
          kind: "DISPATCHES",
        },
        {
          source: "likesRetrieval",
          target: "likesRetrieved",
          kind: "DISPATCHES",
        },
        {
          source: "likesRetrieval",
          target: "likesRetrievalFailed",
          kind: "DISPATCHES",
        },
        {
          source: "likesRetrievalPending",
          target: "lState",
          kind: "UPDATES",
        },
        {
          source: "likesRetrieved",
          target: "lState",
          kind: "UPDATES",
        },
        {
          source: "likesRetrievalFailed",
          target: "lState",
          kind: "UPDATES",
        },
      ]),
    );
    expect(graph.edges).not.toContainEqual({
      source: "projectionSyncListenerFactory",
      target: "likesRetrieval",
      kind: "DISPATCHES",
    });
  }, 60_000);
});
