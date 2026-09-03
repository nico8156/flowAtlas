# Codex MCP Exploration Evaluation

## Purpose

This evaluation checks whether Codex can select FlowAtlas through MCP, whether
MCP changes exploration cost relative to the CLI, and whether the ephemeral
server observes source changes without a restart.

The results are paired observations, not a statistical benchmark. Codex runs
are stochastic, cached input varies, and reported command groups are not a
stable unit of work.

## Autonomous tool selection

The first read-only task named the exact Event `uiLikeToggleRequested` but did
not mention FlowAtlas or MCP. With the initial repository skill, Codex selected
the CLI even though the MCP server was available. This was the behavioural RED.

The skill now prefers `flowatlas_find_nodes` and `flowatlas_get_context` when
configured and keeps the source-checkout CLI as fallback. Replaying the same
task made Codex call `flowatlas_get_context` directly, read the one referenced
business source, and avoid both the CLI and a broad confirmation search.

The local Codex client is configured with:

```text
codex mcp add flowatlas -- node /absolute/path/to/FlowAtlas/dist/mcp.js
```

This is user-local client state, not repository configuration. A new Codex
process discovered the server as enabled over `stdio`.

## Change-oriented comparison

Both runs received the same read-only task: plan the smallest safe change for
a notification when the optimistic Like count reaches ten, starting from
`uiLikeToggleRequested` in the real Fragments checkout.

| Measure               | CLI control | MCP treatment |
| --------------------- | ----------: | ------------: |
| Input tokens          |     269,046 |       210,109 |
| Cached input tokens   |     232,832 |       174,464 |
| Output tokens         |       3,392 |         3,316 |
| Reported files opened |          16 |            15 |
| FlowAtlas requests    |           1 |             2 |

The MCP treatment used approximately 21.9% fewer input tokens. Both runs found
the canonical optimistic Like relations, kept outbox and reconciliation
concerns separate, and identified the missing notification boundary as a
decision rather than inventing one.

The result does not prove that MCP is universally cheaper. Codex issued the
same `flowatlas_get_context` request twice in both MCP change-oriented runs.
Because the ephemeral server scans per request, this duplicated analysis cost
and latency even though the final context remained smaller than the CLI run.

## Structured result behavior

Returning the full JSON as both text and `structuredContent` duplicated the
tool payload. Returning `content: []` removed that duplication but did not stop
Codex from repeating the change-oriented call. The final contract therefore
uses one compact textual acknowledgement and keeps the complete architecture
only in `structuredContent`.

The repeated call is treated as client behavior to measure, not silently
hidden with a cache. It provides evidence for the next architecture review on
session persistence or deterministic request reuse.

## Freshness

A single long-lived MCP server was queried twice against the same temporary
TypeScript project:

1. `flowatlas_find_nodes("freshEvent")` returned no match;
2. the source file was modified to declare `freshEvent`;
3. the same client and server queried the same `projectPath` again;
4. the second result returned `freshEvent` at `actions.ts:2`.

This proves the current scan-per-request implementation does not serve stale
architecture after a source change. The temporary project was removed after
the check.

## Decision

The Codex MCP experience is validated: discovery works, MCP is selected
autonomously, structured results guide source reading, one paired task shows a
context reduction, and freshness is preserved.

The next milestone must review persistent-session options against the observed
duplicate scan cost. It must preserve the freshness property established here
and may not introduce caching, invalidation or a retained graph without that
explicit architecture decision.

## Persistence follow-up

The subsequent architecture review selected a session-local verified snapshot.
Before reusing its last `ArchitectureGraph`, the MCP composition reloads the
requested project and compares a content-derived fingerprint covering source
paths, source contents, project files and TypeScript configuration. A changed
fingerprint rebuilds the graph synchronously; verification and rebuild failures
are propagated rather than masked by the previous snapshot.

This addresses the duplicated-scan driver without introducing a TTL, watcher,
persisted graph or MCP-visible session protocol. A separate large-checkout
benchmark remains necessary to quantify the time saved.
