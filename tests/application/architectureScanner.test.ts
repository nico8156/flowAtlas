import { describe, expect, it, vi } from "vitest";

import type { ArchitectureScanner } from "../../src/application/architectureScanner.js";
import { createArchitectureGraph } from "../../src/domain/architectureGraph.js";
import { createJavaArchitectureScanner } from "../../src/scanner/javaArchitectureScanner.js";
import { createTypeScriptArchitectureScanner } from "../../src/scanner/typeScriptArchitectureScanner.js";

const scan = async (scanner: ArchitectureScanner, projectPath: string) =>
  scanner.scan({ projectPath });

describe("Architecture scanner port", () => {
  it("keeps TypeScript and Java mechanics behind one asynchronous application contract", async () => {
    const typeScriptGraph = createArchitectureGraph();
    typeScriptGraph.addNode({ id: "uiRequested", kind: "Event" });
    const loadTypeScriptGraph = vi.fn(async () => typeScriptGraph);
    const typeScriptResult = await scan(
      createTypeScriptArchitectureScanner(loadTypeScriptGraph),
      "/workspace/front",
    );

    const loadJavaEvidence = vi.fn(async () => ({
      types: [
        {
          qualifiedName: "fixture.AcceptedEvent",
          assignableToDomainEvent: true,
          source: { file: "fixture/AcceptedEvent.java", line: 3, inScanScope: false },
        },
      ],
      handler: {
        qualifiedName: "fixture.AcceptedHandler",
        eventType: "fixture.AcceptedEvent",
        source: { file: "fixture/AcceptedHandler.java", line: 5, inScanScope: true },
      },
      domainEventPublications: [],
      diagnostics: [
        {
          kind: "WARNING",
          message: "fixture warning",
          source: { file: "fixture/AcceptedHandler.java", line: 8, inScanScope: true },
        },
      ],
    }));
    const javaResult = await scan(
      createJavaArchitectureScanner(loadJavaEvidence),
      "/workspace/backend",
    );

    expect(loadTypeScriptGraph).toHaveBeenCalledWith("/workspace/front");
    expect(typeScriptResult).toEqual({ graph: typeScriptGraph, diagnostics: [] });
    expect(loadJavaEvidence).toHaveBeenCalledWith("/workspace/backend");
    expect(javaResult.graph.findNode("java-domain-event:fixture.AcceptedEvent")).toBeDefined();
    expect(javaResult.diagnostics).toEqual([
      {
        severity: "warning",
        message: "fixture warning",
        sourceLocation: { file: "fixture/AcceptedHandler.java", line: 8 },
      },
    ]);
  });
});
