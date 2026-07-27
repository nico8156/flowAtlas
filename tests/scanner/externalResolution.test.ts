import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  scanTypeScriptProject,
  scanTypeScriptSource,
} from "../../src/scanner/typeScriptScanner.js";
describe("External resolution", () => {
  it("detects a gateway interface as an External node", async () => {
    const file = "tests/fixtures/externalGateway.ts";
    const source = await readFile(
      new URL("../fixtures/externalGateway.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "LikeWlGateway",
      kind: "External",
    });
  });

  it("detects a Handler calling an External gateway", async () => {
    const file = "tests/fixtures/callsExternalGateway.ts";
    const source = await readFile(
      new URL("../fixtures/callsExternalGateway.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "submitListener",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
  });

  it("traverses internal orchestration to the External gateway", async () => {
    const file = "tests/fixtures/transitiveExternalCall.ts";
    const source = await readFile(
      new URL("../fixtures/transitiveExternalCall.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "processOutboxFactory",
      kind: "Handler",
    });
    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendOutboxCommand",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getOutboxCommandGateway",
      kind: "Handler",
    });
  });

  it("traverses an External gateway passed through an internal object argument", async () => {
    const file = "tests/fixtures/transitiveExternalObjectArgument.ts";
    const source = await readFile(
      new URL("../fixtures/transitiveExternalObjectArgument.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.nodes).toContainEqual({
      id: "handlerFactory",
      kind: "Handler",
    });
    expect(graph.nodes).toContainEqual({
      id: "LikeGateway",
      kind: "External",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("resolves an External propagated through a function return type", async () => {
    const file = "tests/fixtures/externalReturnTypePropagation.ts";
    const source = await readFile(
      new URL("../fixtures/externalReturnTypePropagation.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("keeps all statically possible External gateways", async () => {
    const file = "tests/fixtures/multipleExternalGateways.ts";
    const source = await readFile(
      new URL("../fixtures/multipleExternalGateways.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "CommentGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("keeps all External gateways returned by a discriminated switch", async () => {
    const file = "tests/fixtures/switchSelectedExternal.ts";
    const source = await readFile(
      new URL("../fixtures/switchSelectedExternal.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("selects the External gateway from a known command kind", async () => {
    const file = "tests/fixtures/commandSelectedExternal.ts";
    const source = await readFile(
      new URL("../fixtures/commandSelectedExternal.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "LikeGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).not.toContainEqual({
      source: "processOutboxFactory",
      target: "CommentGateway",
      kind: "CALLS_EXTERNAL",
    });
  });

  it("traverses the real outbox gateway selection chain", async () => {
    const file = "tests/fixtures/transitiveOutboxSelection.ts";
    const source = await readFile(
      new URL("../fixtures/transitiveOutboxSelection.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "processOutbox",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getOutboxCommandGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendOutboxCommand",
      kind: "Handler",
    });
  });

  it("preserves External possibilities through an untyped routed command helper", async () => {
    const file = "tests/fixtures/fragmentsOutboxRouting.ts";
    const source = await readFile(
      new URL("../fixtures/fragmentsOutboxRouting.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });
    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("resolves External orchestration functions across files", async () => {
    const files = [
      "tests/fixtures/crossFileOutboxRouting.ts",
      "tests/fixtures/crossFileOutboxHandler.ts",
    ];
    const graph = scanTypeScriptProject({
      files: await Promise.all(
        files.map(async (file) => ({
          file,
          source: await readFile(
            new URL(`../fixtures/${file.split("/").pop()}`, import.meta.url),
            "utf8",
          ),
        })),
      ),
    });

    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "processOutboxFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("propagates External bindings into destructured helper parameters", async () => {
    const file = "tests/fixtures/destructuredExternalGateway.ts";
    const source = await readFile(
      new URL("../fixtures/destructuredExternalGateway.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("resolves External returns from an optionally available gateway dependency", async () => {
    const file = "tests/fixtures/optionalExternalGatewayDependency.ts";
    const source = await readFile(
      new URL("../fixtures/optionalExternalGatewayDependency.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "getGateway",
      kind: "Handler",
    });
    expect(graph.nodes).not.toContainEqual({
      id: "sendCommand",
      kind: "Handler",
    });
  });

  it("resolves equivalent function and arrow function forms uniformly", async () => {
    const file = "tests/fixtures/functionLikeForms.ts";
    const source = await readFile(
      new URL("../fixtures/functionLikeForms.ts", import.meta.url),
      "utf8",
    );

    const graph = scanTypeScriptSource({ file, source });

    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "LikeWlGateway",
      kind: "CALLS_EXTERNAL",
    });
    expect(graph.edges).toContainEqual({
      source: "handlerFactory",
      target: "CommentsGateway",
      kind: "CALLS_EXTERNAL",
    });
  });
});
