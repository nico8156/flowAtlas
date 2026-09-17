import { describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

describeFragments("Fragments profile listener scoping", () => {
  it("does not mix profile update and avatar registrations from the shared listener factory", async () => {
    const files = [
      "app/core-logic/contextWL/userWl/usecases/profile/profileUpdateListenerFactory.ts",
      "app/core-logic/contextWL/userWl/typeAction/user.action.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.actions.ts",
      "app/core-logic/contextWL/outboxWl/typeAction/outbox.type.ts",
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

    const profileHandler = "profileUpdateListenerFactory[profileUpdateRequested]";
    const avatarAttachHandler = "profileUpdateListenerFactory[avatarAttachRequested]";
    const avatarRemoveHandler = "profileUpdateListenerFactory[avatarRemoveRequested]";

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: profileHandler, kind: "Handler" }),
        expect.objectContaining({ id: avatarAttachHandler, kind: "Handler" }),
        expect.objectContaining({ id: avatarRemoveHandler, kind: "Handler" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { source: profileHandler, target: "profileUpdateRequested", kind: "LISTENS_TO" },
        { source: profileHandler, target: "profileUpdateOptimistic", kind: "DISPATCHES" },
        { source: profileHandler, target: "enqueueCommitted", kind: "DISPATCHES" },
        { source: profileHandler, target: "outboxProcessOnce", kind: "DISPATCHES" },
        { source: avatarAttachHandler, target: "avatarAttachRequested", kind: "LISTENS_TO" },
        { source: avatarAttachHandler, target: "avatarUpdateOptimistic", kind: "DISPATCHES" },
      ]),
    );
    expect(graph.edges).not.toContainEqual({
      source: profileHandler,
      target: "avatarUpdateOptimistic",
      kind: "DISPATCHES",
    });
  }, 60_000);
});
