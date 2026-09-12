import { describe, expect, it } from "vitest";

import { formatJavaSemanticFailure } from "../../src/scanner/javaMavenArchitectureScanner.js";

describe("Java Maven architecture scanner", () => {
  it("turns a stale semantic request failure into an actionable message", () => {
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
});
