// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { scanTypeScriptProject } from "../../src/scanner/typeScriptScanner.js";
import { ArchitectureMap } from "../../src/visualizer/ArchitectureMap.js";
import { fragmentsAvailable, readFragment, readFragmentProjectSources } from "./fragmentsSource.js";

const describeFragments = fragmentsAvailable ? describe : describe.skip;

beforeAll(() => {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
});

afterEach(cleanup);

describeFragments("Fragments visualizer acceptance", () => {
  it("renders and inspects a node from a real scanned graph", async () => {
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

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.click(explorer.getByRole("button", { name: "uiTicketSubmitRequested" }));

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(inspector.textContent).toContain("uiTicketSubmitRequested");
    expect(inspector.textContent).toContain("Event");
  }, 20_000);
});
