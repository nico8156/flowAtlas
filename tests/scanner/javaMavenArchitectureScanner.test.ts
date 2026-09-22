import { describe, expect, it } from "vitest";

import { formatJavaSemanticFailure } from "../../src/scanner/javaMavenArchitectureScanner.js";

describe("Java Maven architecture scanner", () => {
  it("turns a semantic proof failure into an actionable message", () => {
    const error = formatJavaSemanticFailure("/workspace/request.json", {
      stderr:
        'Exception in thread "main" java.lang.IllegalStateException: Could not prove one configured handler port invocation\n',
    });

    expect(error.message).toContain("/workspace/request.json");
    expect(error.message).toContain("Could not prove one configured handler port invocation");
    expect(error.message).toContain("scanSources or resolutionSources");
  });

  it("preserves the configured property named by a semantic proof failure", () => {
    const error = formatJavaSemanticFailure("/workspace/request.json", {
      stderr:
        'Exception in thread "main" java.lang.IllegalStateException: Could not prove configured external handler invocation: handler=fixture.Worker#run(); port=fixture.Provider; method=verify\n',
    });

    expect(error.message).toContain("handler=fixture.Worker#run()");
    expect(error.message).toContain("port=fixture.Provider");
  });

  it("reports a compiler diagnostic without the Java command and classpath", () => {
    const error = formatJavaSemanticFailure("/workspace/request.json", {
      stderr: [
        "Error: Command failed: /jdk/bin/java --classpath /very/long/dependency/classpath",
        "/workspace/src/Handler.java:12: error: cannot find symbol",
        "  symbol: class MissingPort",
      ].join("\n"),
    });

    expect(error.message).toContain("/workspace/src/Handler.java:12: error: cannot find symbol");
    expect(error.message).toContain("symbol: class MissingPort");
    expect(error.message).not.toContain("--classpath");
    expect(error.message).not.toContain("stale or incomplete");
  });

  it("reports a request validation error without the child process command", () => {
    const error = formatJavaSemanticFailure("/workspace/request.json", {
      stderr: [
        "Error: Command failed: node scripts/javaMavenSemanticContext.mjs --classpath /many/dependencies",
        "Error: Java Maven semantic context: all projection request properties must be provided together",
        "    at fail (scripts/javaMavenSemanticContext.mjs:17:9)",
      ].join("\n"),
    });

    expect(error.message).toContain("all projection request properties must be provided together");
    expect(error.message).not.toContain("--classpath");
  });
});
