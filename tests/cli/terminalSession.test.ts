import { describe, expect, it } from "vitest";

import { runInAlternateTerminalScreen } from "../../src/cli/terminalSession.js";

describe("terminal session", () => {
  it("restores the previous terminal screen after the session ends", async () => {
    const writes: string[] = [];

    await runInAlternateTerminalScreen(
      (sequence) => writes.push(sequence),
      async () => "completed",
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]).toContain("[?1049h");
    expect(writes[1]).toContain("[?1049l");
  });
});
