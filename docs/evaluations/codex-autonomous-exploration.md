# Codex Autonomous Exploration Evaluation

## Purpose

This evaluation asks whether Codex can choose FlowAtlas by itself and use it as
an orientation map for a real event-driven use case. It is an integration
check, not evidence yet that FlowAtlas reduces tokens or task duration.

## Protocol

Both read-only, ephemeral Codex runs analyzed the Like path in
`../fragmentsCleanFront` from `uiLikeToggleRequested` through optimistic state,
the outbox and the external boundary. Both had to report architectural nodes,
canonical relations, static gaps, files opened and commands run.

- Control: the prompt prohibited FlowAtlas and required ordinary repository
  exploration.
- Treatment: the prompt only required repository instructions and relevant
  local tooling. `AGENTS.md` advertised the repository-owned
  `architecture-exploration` skill; the prompt did not tell Codex to invoke
  FlowAtlas.

The comparison is a single paired observation. Codex runs are stochastic, and
token accounting includes command results and cached input. The figures are
therefore diagnostic, not a benchmark.

## Observations

| Measure                 | Control | FlowAtlas treatment |
| ----------------------- | ------: | ------------------: |
| Input tokens            | 190,819 |             796,153 |
| Cached input tokens     | 148,224 |             750,592 |
| Output tokens           |   4,126 |               5,474 |
| Reported files opened   |      19 |                  23 |
| Reported command groups |       4 |                   7 |

The autonomous connection succeeded. Codex loaded the skill, found the Event,
requested bounded JSON contexts, opened referenced sources and retained the
important absence of a proven causal link to later projection or acknowledgement
branches. The first context around `uiLikeToggleRequested` was complete at 10
nodes and 11 edges. Codex then requested focused context around the outbox
processor to reach the external boundary.

The treatment did not reduce exploration cost. It searched for an already
known id before using FlowAtlas, repeated discovery, expanded additional
territory and triggered several full project scans. Its final architectural
identifiers were more canonical than the control, but that qualitative result
does not compensate for the measured overhead.

## Resulting decision

The repository procedure now makes the economical path explicit:

1. an exact architectural id goes directly to `context`;
2. `find` is reserved for an unknown entry point;
3. one bounded projection is the default;
4. only a task-relevant frontier or depth boundary justifies another request;
5. source reading remains mandatory but selective.

Milestone 4 therefore validates autonomous tool selection and exposes a real
performance problem. It does **not** establish context savings. Repeated CLI
scans and agent exploration policy must be measured separately before they can
justify a persistent MCP process, caching or a combined query-to-context
application capability.

A follow-up, deliberately narrow verification supplied the exact Event id and
asked only for its immediate neighborhood. With the tightened policy, Codex
used no `rg`, file enumeration or `find`; it requested one depth-1 context and
opened the single referenced business source. The run used 149,824 input
tokens, including 138,752 cached tokens, and 1,196 output tokens. This validates
the stop behavior, but it is not comparable to the broader paired task above.

The follow-up also exposed an invocation concern: `npx flowatlas` is not
reliable inside the private FlowAtlas source package. The repository skill now
uses `node dist/index.js`; a future consuming repository may use its installed
package binary. Packaging remains separate from the architectural context
contract.

## Reproduction shape

Run Codex ephemerally and read-only against the same checkout and task. The
treatment prompt should not name FlowAtlas; otherwise it tests prompt obedience
rather than autonomous repository guidance. Capture the final token usage and
require a structured report of files and commands so that hidden exploration
cost remains visible.
