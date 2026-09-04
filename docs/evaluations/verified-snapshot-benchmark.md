# Verified MCP Snapshot Benchmark

## Scope

This benchmark measures the graph-loading composition used by the MCP server:

```text
load TypeScript project -> fingerprint current content -> reuse or scan graph
```

It does not measure MCP transport, agent tokens or task quality. Every request
still reloads and fingerprints the checkout, so the repeated-request result is
the cost of verified reuse rather than an unverified in-memory cache hit.

## Reproduction

Environment recorded by the report: Node `v22.16.0`, macOS (`darwin`, `x64`).
FlowAtlas was at `886f74b60fc9d6b9ed06191ec58aebe83080f148`.

```bash
npm run build
npm run benchmark:mcp -- ../fragmentsCleanFront --iterations=5
npm run benchmark:mcp -- /path/to/redux-essentials-example-app --iterations=5
npm run benchmark:mcp -- ../fragmentsCleanFront --iterations=7 --verification=metadata
```

The Fragments checkout was at
`0b2956d0fc24c3e531cea180448d5493e42a7d13`. Redux Essentials used the
`tutorial-steps-ts` branch at
`ec4657debf4e516a88bb91839fcc894d735a5a2e`.

## Observations

| Corpus           |                 Graph | First request | Repeated samples                  | Repeated median | Observed speedup | Scans / requests |
| ---------------- | --------------------: | ------------: | --------------------------------- | --------------: | ---------------: | ---------------: |
| Fragments        | 197 nodes / 289 edges |    4562.69 ms | 262.77, 260.31, 266.79, 254.89 ms |       261.54 ms |           17.45x |            1 / 5 |
| Redux Essentials |    12 nodes / 9 edges |    1531.31 ms | 12.84, 8.01, 9.34, 9.22 ms        |         9.28 ms |          165.01x |            1 / 5 |

Both observations prove the intended technical property: five unchanged graph
requests perform one architecture scan. They do not establish a universal
speedup; filesystem caches, hardware, checkout size and source shape affect
the wall-clock values.

The larger Fragments checkout retains a measurable repeated cost because
freshness verification rereads and hashes its sources. This is expected under
the content-verified snapshot contract and identifies project loading and
fingerprinting—not rescanning—as the next performance boundary to investigate
if repeated latency becomes a problem.

## Phase breakdown

The first optimization measurement added phase-level samples at FlowAtlas
commit `869031a`. A five-request rerun observed:

| Corpus           | First scan | Repeated file discovery           | Repeated source read          | Repeated fingerprint          |
| ---------------- | ---------: | --------------------------------- | ----------------------------- | ----------------------------- |
| Fragments        | 4849.26 ms | 361.74, 265.13, 263.90, 264.97 ms | 21.34, 13.22, 14.10, 16.94 ms | 25.93, 17.88, 17.81, 20.61 ms |
| Redux Essentials | 1689.61 ms | 8.34, 7.35, 7.64, 4.39 ms         | 5.05, 2.01, 1.22, 1.13 ms     | 1.38, 1.03, 0.72, 0.74 ms     |

Canonical path resolution remained below `0.31 ms` in every sample. On the
larger Fragments checkout, recursive file discovery—not content hashing—is the
dominant repeated cost. The next optimization should therefore retain a
session-local file manifest before considering a hashing algorithm change.

### Metadata-mode experiment

A same-machine seven-request comparison on Fragments observed a repeated
median of `1621.78 ms` with content verification and `552.13 ms` with metadata
verification, approximately 66% lower. The metadata samples were `473.23`,
`574.91`, `559.65`, `506.42`, `550.76` and `553.49 ms`.

The result justifies keeping metadata verification as an explicit option, not
as the default. Its contract is weaker, and its remaining latency is dominated
by manifest inspection. When a manifest change is detected, the session
snapshot rereads only added or metadata-changed files, reuses unchanged source
objects, drops deleted files and reloads `tsconfig.json` only when its metadata
changes. The architecture graph itself is still rebuilt in full.

## TypeScript Program reuse

The change benchmark appends one newline in memory to an explicitly selected
file, scans through a session scanner, then performs a cold comparison scan:

```bash
npm run benchmark:mcp -- ../fragmentsCleanFront \
  --program-reuse-file=app/store/appStateWl.ts
npm run benchmark:mcp -- /path/to/redux-essentials-example-app \
  --program-reuse-file=src/features/auth/authSlice.ts
```

Two sequential observations produced:

| Corpus           | Reused total | Cold total | Reused compiler | Cold compiler | Equivalent graph |
| ---------------- | -----------: | ---------: | --------------: | ------------: | ---------------- |
| Fragments        |   3150.25 ms | 3562.90 ms |       732.97 ms |    1178.31 ms | yes              |
| Redux Essentials |    855.72 ms |  822.70 ms |       791.31 ms |     762.69 ms | yes              |

Fragments showed an approximately 11.6% total reduction and 37.8% compiler
context reduction. Redux Essentials was about 4% slower with reuse on this
run. Program reuse is therefore useful for the larger observed project but is
not claimed as a universal speedup. Its invariant is stronger than its timing:
the complete rebuilt graph must equal a cold scan after the same modification.

## Context operation breakdown

The focused-context benchmark separates node lookup, bounded projection and
JSON serialization after the architecture graph has been built:

```bash
npm run benchmark:mcp -- ../fragmentsCleanFront \
  --iterations=1000 --context-node=uiLikeToggleRequested
npm run benchmark:mcp -- /path/to/redux-essentials-example-app \
  --iterations=1000 --context-node=login
```

The following observations were recorded after FlowAtlas commit `995d033`:

| Corpus           |                 Graph | Operation          |  Median |     P95 |      Max | Context JSON |
| ---------------- | --------------------: | ------------------ | ------: | ------: | -------: | -----------: |
| Fragments        | 197 nodes / 289 edges | Node lookup        |    0 ms |    0 ms |  0.03 ms |       3485 B |
|                  |                       | Bounded projection | 0.14 ms | 0.27 ms | 13.63 ms |              |
|                  |                       | Serialization      | 0.01 ms | 0.02 ms |  0.06 ms |              |
| Redux Essentials |    12 nodes / 9 edges | Node lookup        |    0 ms |    0 ms |  0.02 ms |       1665 B |
|                  |                       | Bounded projection | 0.02 ms | 0.05 ms | 16.95 ms |              |
|                  |                       | Serialization      | 0.01 ms | 0.01 ms |  0.11 ms |              |

These are same-machine observations, not latency guarantees. They do show
that query, traversal and serialization are negligible beside project loading
and scanning for the currently validated graph sizes. Adding adjacency indexes
to the canonical graph is therefore not justified by evidence at this stage.
The benchmark remains available to revisit that decision on a materially
larger corpus.

## Excluded self-scan

The FlowAtlas repository root is not a valid architecture benchmark corpus in
its current form. Its `tsconfig.json` deliberately includes scanner fixtures
that model mutually contradictory and invalid source fragments. Aggregating
them as one application correctly trips a strict graph invariant. The
benchmark reports that failure rather than suppressing it; Fragments and Redux
Essentials provide two valid real checkouts instead.
