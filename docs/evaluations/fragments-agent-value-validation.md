# Fragments Agent Value Validation

## Purpose

This evaluation asks whether a bounded FlowAtlas MCP projection reduces the
exploration required by a coding agent without weakening its architectural
account. It is one paired observation, not a statistical benchmark.

## Protocol

Two fresh, ephemeral Codex CLI `0.152.1` processes analyzed Fragments commit
`0b2956d0fc24c3e531cea180448d5493e42a7d13` in read-only mode. Both started
from the exact Event `uiLikeToggleRequested` and had to trace statically
supportable architecture through optimistic Like state and the offline outbox
toward the first identifiable external boundary. They also had to identify
static gaps and the minimum files required before changing retry behavior.

- Control: FlowAtlas was disabled and ordinary repository exploration was
  required.
- Treatment: the configured MCP server at FlowAtlas commit `43f3e33` was
  required as the initial orientation map. Source reading remained mandatory.

The prompt explicitly required MCP in the treatment. This measures value when
the tool is used; it does not measure autonomous tool selection. Raw traces
were retained only in temporary files because they contain source excerpts.

## Quantitative observation

| Measure                   |   Control | MCP treatment | Change |
| ------------------------- | --------: | ------------: | -----: |
| Input tokens              |   694,360 |       350,270 | -49.6% |
| Cached input tokens       |   634,496 |       315,264 | -50.3% |
| Output tokens             |     5,137 |         4,984 |  -3.0% |
| Files reported opened     |        26 |            18 | -30.8% |
| Search commands           |         6 |             3 | -50.0% |
| Tool calls                |        15 |            11 | -26.7% |
| Captured JSONL trace size | 167,637 B |     107,518 B | -35.9% |
| FlowAtlas requests        |         0 |             2 |        |
| FlowAtlas context JSON    |         0 |       9,230 B |        |

The treatment requested two complete, untruncated schema-v2 contexts:

1. `uiLikeToggleRequested`, downstream depth 3: 10 nodes, 13 edges,
   `3,880 B`;
2. `processOutboxFactory`, downstream depth 3: 14 nodes, 23 edges,
   `5,350 B`.

The second request was justified by the first projection ending at the outbox
processor before the required external boundary.

## Qualitative comparison

Both runs reconstructed the same central path:

```text
uiLikeToggleRequested
  -> likeToggleUseCaseFactory
  -> optimistic Like state
  -> enqueueCommitted / outbox state
  -> outboxProcessOnce / processOutboxFactory
  -> LikeWlGateway
```

Both independently found two important retry risks in source:

- `nextAttemptAt` prevents premature selection but no observed timer dispatches
  `outboxProcessOnce` when that queued retry becomes due;
- an immediate classified business rejection is rolled back and then scheduled
  for retry, conflicting with the repository doctrine that rejection should be
  terminal.

The control continued to the concrete HTTP adapter and `fetch`. The treatment
stopped at the requested write-side port boundary and separately noticed that
the auth-token gateway is called before optimistic mutation. Neither run
invented behavior beyond the source it read.

The treatment did not execute tests, while the control voluntarily ran three
targeted suites. Test counts are therefore not comparable for this read-only
task. Both reported a clean checkout and made no source edit.

## Product evidence

The observation supports the narrow claim that FlowAtlas can reduce agent
exploration on this Redux architecture. The agent received `9,230 B` of
precomputed architectural context and used roughly half the input tokens and
searches while preserving the important architectural account.

It also exposes two truthful scanner limits:

- the auth-token dependency is absent from the projection even though source
  shows it as an earlier external call;
- the generic outbox processor is connected to every statically possible
  gateway, so source inspection must narrow `Like.Add` and `Like.Remove` to
  `LikeWlGateway`.

These are not reasons to infer missing causality. They confirm that the graph
is an orientation map and that referenced source must still be read.

## Limitations

- one paired run cannot establish a stable average or causal effect;
- Codex runs are stochastic and the configured model was not recorded in the
  trace metadata;
- cached input is included in the reported input-token counts;
- the treatment was instructed to use MCP, so autonomy was not tested;
- the control's voluntary test execution widened its work relative to the
  treatment;
- the task supplied an exact node id and did not evaluate discovery.

The result justifies repeated trials on additional tasks before making a broad
performance claim. It does not justify changing graph vocabulary or filling
the observed static gaps heuristically.
