import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { detectJavaProjectionGraph } from "../../src/scanner/javaProjectionDetector.js";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repositoryRoot, "tests/fixtures/java-semantic-project");
const requestPath = resolve(fixtureRoot, "flowatlas-java-local-projection-request.json");

describe("local Java projection", () => {
  it("projects an event-fed state mutation without a sync notification", async () => {
    const { stdout } = await execFileAsync(
      "node",
      ["scripts/javaMavenSemanticContext.mjs", fixtureRoot, requestPath],
      { cwd: repositoryRoot, maxBuffer: 1024 * 1024 },
    );
    const graph = detectJavaProjectionGraph(JSON.parse(stdout));

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "java-domain-event:fixture.events.TicketVerifyAcceptedEvent",
          kind: "Event",
        }),
        expect.objectContaining({ id: "localWalks", kind: "State" }),
      ]),
    );
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "java-domain-event:fixture.events.TicketVerifyAcceptedEvent",
          target: "localWalks",
          kind: "UPDATES",
        }),
      ]),
    );
    expect(graph.nodes.some((node) => node.id.startsWith("sync:"))).toBe(false);
    expect(graph.nodes.some((node) => node.id.includes("LocalOutboxDispatcher"))).toBe(false);
    expect(graph.edges.some((edge) => edge.kind === "DISPATCHES")).toBe(false);
  }, 30_000);
});
