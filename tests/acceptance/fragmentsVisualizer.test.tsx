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

const scanTicketGraph = async () => {
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

  return scanTypeScriptProject({
    tsconfig,
    files: await Promise.all(
      files.map(async (file) => ({
        file,
        source: await readFragment(file),
      })),
    ),
    projectFiles: await readFragmentProjectSources(),
  });
};

describeFragments("Fragments visualizer acceptance", () => {
  it("renders and inspects a node from a real scanned graph", async () => {
    const graph = await scanTicketGraph();

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.click(explorer.getByRole("button", { name: "uiTicketSubmitRequested" }));

    const inspector = screen.getByRole("region", { name: "Inspector" });
    expect(inspector.textContent).toContain("uiTicketSubmitRequested");
    expect(inspector.textContent).toContain("Event");
  }, 20_000);

  it("explores a real scanned ticket territory downstream", async () => {
    const graph = await scanTicketGraph();

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.click(explorer.getByRole("button", { name: "uiTicketSubmitRequested" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Explore downstream from uiTicketSubmitRequested" }),
    );

    expect(explorer.getByRole("button", { name: "TicketsWlGateway" })).toBeTruthy();
  }, 20_000);

  it("explores a real scanned ticket state territory upstream", async () => {
    const graph = await scanTicketGraph();

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.click(explorer.getByRole("button", { name: "tState" }));
    fireEvent.click(screen.getByRole("button", { name: "Explore upstream from tState" }));

    expect(explorer.getByRole("button", { name: "ticketSubmitUseCaseFactory" })).toBeTruthy();
    expect(explorer.getByRole("button", { name: "ticketRetrieval" })).toBeTruthy();
    expect(explorer.getByRole("button", { name: "uiTicketSubmitRequested" })).toBeTruthy();
  }, 20_000);

  it("filters a real scanned graph by architectural node kind", async () => {
    const graph = await scanTicketGraph();

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by node kind" }), {
      target: { value: "Event" },
    });

    expect(explorer.getByRole("button", { name: "uiTicketSubmitRequested" })).toBeTruthy();
    expect(explorer.queryByRole("button", { name: "tState" })).toBeNull();
  }, 20_000);

  it("shows the source location of a real scanned node", async () => {
    const graph = await scanTicketGraph();

    render(<ArchitectureMap graph={graph} />);

    const explorer = within(screen.getByRole("complementary", { name: "Explorer" }));
    fireEvent.click(explorer.getByRole("button", { name: "uiTicketSubmitRequested" }));

    expect(screen.getByRole("region", { name: "Inspector" }).textContent).toContain(
      "ticketSubmitWlUseCase.ts:",
    );
  }, 20_000);
});
