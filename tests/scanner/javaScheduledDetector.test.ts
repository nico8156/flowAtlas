import { describe, expect, it } from "vitest";

import { detectJavaScheduledGraph } from "../../src/scanner/javaScheduledDetector.js";

describe("Java scheduled detector", () => {
  it("projects an in-scope scheduled method as a protocol signal listened to by its worker", () => {
    const graph = detectJavaScheduledGraph({
      scheduledHandlers: [
        {
          handler: "fixture.ScheduledWorker",
          method: "runDue()",
          source: { file: "fixture/ScheduledWorker.java", line: 12, inScanScope: true },
        },
      ],
    });

    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "fixture.ScheduledWorker",
        target: "protocol:scheduled:fixture.ScheduledWorker#runDue()",
        kind: "LISTENS_TO",
      }),
    ]);
  });
});
