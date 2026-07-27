import { describe, expect, it } from "vitest";

import { readFixture } from "./fixtureSource.js";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
describe("Project scanning", () => {
  it("builds one shared semantic index for multiple declaration lookups", () => {
    let semanticIndexBuilds = 0;
    const project = {
      files: [
        {
          file: "src/feature/handlers.ts",
          source: `
            type Dependencies = { gateway: LikeWlGateway };

            const retrieveLikes = () =>
              async (_dispatch: unknown, _getState: unknown, dependencies: Dependencies) => {
                const gateway = dependencies.gateway;
                await gateway.get();
              };

            const retrieveComments = () =>
              async (_dispatch: unknown, _getState: unknown, dependencies: Dependencies) => {
                const gateway = dependencies.gateway;
                await gateway.get();
              };
          `,
        },
        {
          file: "src/feature/gateway.ts",
          source: `
            export interface LikeWlGateway {
              get(): Promise<void>;
            }
          `,
        },
      ],
      onSemanticIndexBuilt: () => {
        semanticIndexBuilds += 1;
      },
    };

    scanTypeScriptProject(project);

    expect(semanticIndexBuilds).toBe(1);
  });

  it("reuses project context resolution across multiple scoped handlers", () => {
    let sharedContextReads = 0;
    const sharedContext = {
      file: "src/shared/gateway.ts",
      get source() {
        sharedContextReads += 1;
        return `
          import type { LikeWlGateway } from "../feature/gateway";

          export type Dependencies = { likes: LikeWlGateway };
          export const getGateway = (dependencies: Dependencies): LikeWlGateway =>
            dependencies.likes;
        `;
      },
    };

    const scopedFiles = [
      {
        file: "src/feature/handlers.ts",
        source: `
            import { getGateway } from "../shared/gateway";
            import type { Dependencies } from "../shared/gateway";

            const retrieveLikes = () =>
              async (_dispatch: unknown, _getState: unknown, dependencies: Dependencies) => {
                const gateway = getGateway(dependencies);
                await gateway.get();
              };

            const retrieveComments = () =>
              async (_dispatch: unknown, _getState: unknown, dependencies: Dependencies) => {
                const gateway = getGateway(dependencies);
                await gateway.get();
              };
          `,
      },
      {
        file: "src/feature/gateway.ts",
        source: `
            export interface LikeWlGateway {
              get(): Promise<void>;
            }
          `,
      },
    ];
    const graph = scanTypeScriptProject({
      files: scopedFiles,
      projectFiles: [sharedContext, ...scopedFiles],
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        {
          source: "retrieveLikes",
          target: "LikeWlGateway",
          kind: "CALLS_EXTERNAL",
        },
        {
          source: "retrieveComments",
          target: "LikeWlGateway",
          kind: "CALLS_EXTERNAL",
        },
      ]),
    );
    expect(sharedContextReads).toBe(1);
  });

  it("resolves types from project context outside the architectural scan scope", () => {
    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/feature/handler.ts",
          source: `
            import type { Dependencies } from "../shared/dependencies";

            export const retrieve = (): AppThunk<Promise<void>> =>
              async (_dispatch, _getState, gateways) => {
                const likeGateway = gateways.likes;
                await likeGateway.get();
              };
          `,
        },
        {
          file: "src/feature/gateway.ts",
          source: `
            export interface LikeWlGateway {
              get(): Promise<void>;
            }
          `,
        },
      ],
      projectFiles: [
        {
          file: "src/shared/dependencies.ts",
          source: `
            import type { LikeWlGateway } from "../feature/gateway";

            export type Dependencies = {
              gateways: { likes: LikeWlGateway };
            };
          `,
        },
        {
          file: "src/feature/handler.ts",
          source: `
            import type { Dependencies } from "../shared/dependencies";

            type AppThunk<ReturnType> = (
              dispatch: (action: unknown) => void,
              getState: unknown,
              extraArgument: Dependencies["gateways"],
            ) => ReturnType;

            export const retrieve = (): AppThunk<Promise<void>> =>
              async (_dispatch, _getState, gateways) => {
                const likeGateway = gateways.likes;
                await likeGateway.get();
              };
          `,
        },
        {
          file: "src/feature/gateway.ts",
          source: `
            export interface LikeWlGateway {
              get(): Promise<void>;
            }
          `,
        },
      ],
    });

    expect(graph.nodes).toContainEqual({ id: "retrieve", kind: "Handler" });
    expect(graph.nodes).toContainEqual({ id: "LikeWlGateway", kind: "External" });
    expect(graph.edges).toContainEqual({
      source: "retrieve",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
  });

  it("aggregates a simple cross-file topology", () => {
    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/social/actions.ts",
          source: `
            export const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
          `,
        },
        {
          file: "src/social/listener.ts",
          source: `
            import { uiLikeToggleRequested } from "./actions";
            const submitLikeListener = startListening({
              actionCreator: uiLikeToggleRequested,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    expect(graph.nodes).toContainEqual(
      expect.objectContaining({
        id: "uiLikeToggleRequested",
        kind: "Event",
      }),
    );
    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });

  it("preserves Event identity through a renamed import", () => {
    const graph = scanTypeScriptProject({
      files: [
        {
          file: "src/social/actions.ts",
          source: `
            export const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
          `,
        },
        {
          file: "src/social/listener.ts",
          source: `
            import { uiLikeToggleRequested as toggleRequested } from "./actions";
            const submitLikeListener = startListening({
              actionCreator: toggleRequested,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    expect(graph.edges).toContainEqual({
      source: "submitLikeListener",
      target: "uiLikeToggleRequested",
      kind: "LISTENS_TO",
    });
  });

  it("resolves an aliased import to the correct homonymous module symbol", () => {
    const graph = scanTypeScriptProject({
      tsconfig: {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["src/*"],
          },
        },
      },
      files: [
        {
          file: "src/tickets/actions.ts",
          source: `
            export const refreshed = createAction("TICKETS/REFRESHED");
          `,
        },
        {
          file: "src/social/actions.ts",
          source: `
            export const refreshed = createAction("SOCIAL/REFRESHED");
          `,
        },
        {
          file: "src/listener.ts",
          source: `
            import { refreshed } from "@/social/actions";
            const refreshListener = startListening({
              actionCreator: refreshed,
              effect: async () => {},
            });
          `,
        },
      ],
    });

    const socialEvent = graph.nodes.find(
      (node) => node.kind === "Event" && node.sourceLocation?.file === "src/social/actions.ts",
    );
    const ticketsEvent = graph.nodes.find(
      (node) => node.kind === "Event" && node.sourceLocation?.file === "src/tickets/actions.ts",
    );

    expect(socialEvent).toBeDefined();
    expect(ticketsEvent).toBeDefined();

    if (!socialEvent || !ticketsEvent) {
      return;
    }

    expect(graph.edges).toContainEqual({
      source: "refreshListener",
      target: socialEvent.id,
      kind: "LISTENS_TO",
    });
    expect(graph.edges).not.toContainEqual({
      source: "refreshListener",
      target: ticketsEvent.id,
      kind: "LISTENS_TO",
    });
  });

  it("produces the same graph regardless of project file order", async () => {
    const eventFile = "tests/fixtures/orderIndependentEvent.ts";
    const handlerFile = "tests/fixtures/orderIndependentHandler.ts";
    const sources = new Map(
      await Promise.all(
        [eventFile, handlerFile].map(
          async (file) => [file, await readFixture(file.split("/").pop() ?? "")] as const,
        ),
      ),
    );
    const scan = (files: string[]) =>
      scanTypeScriptProject({
        files: files.map((file) => ({ file, source: sources.get(file) ?? "" })),
      });
    const shape = (graph: ReturnType<typeof scanTypeScriptProject>) => ({
      nodes: graph.nodes
        .map(({ id, kind }) => ({ id, kind }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      edges: graph.edges
        .map(({ source, target, kind }) => ({ source, target, kind }))
        .sort((left, right) =>
          `${left.source}:${left.kind}:${left.target}`.localeCompare(
            `${right.source}:${right.kind}:${right.target}`,
          ),
        ),
    });

    const handlerFirst = scan([handlerFile, eventFile]);
    const eventFirst = scan([eventFile, handlerFile]);

    expect(shape(handlerFirst)).toEqual(shape(eventFirst));
    expect(handlerFirst.nodes).toContainEqual(
      expect.objectContaining({
        id: "dispatchedEvent",
        kind: "Event",
      }),
    );
    expect(handlerFirst.nodes).toContainEqual(
      expect.objectContaining({
        id: "submitListener",
        kind: "Handler",
      }),
    );
    expect(handlerFirst.edges).toContainEqual({
      source: "submitListener",
      target: "dispatchedEvent",
      kind: "DISPATCHES",
    });
  });
});
