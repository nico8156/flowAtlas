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
commit `556e25b`. A five-request rerun observed:

| Corpus           | First scan | Repeated file discovery           | Repeated source read          | Repeated fingerprint          |
| ---------------- | ---------: | --------------------------------- | ----------------------------- | ----------------------------- |
| Fragments        | 4849.26 ms | 361.74, 265.13, 263.90, 264.97 ms | 21.34, 13.22, 14.10, 16.94 ms | 25.93, 17.88, 17.81, 20.61 ms |
| Redux Essentials | 1689.61 ms | 8.34, 7.35, 7.64, 4.39 ms         | 5.05, 2.01, 1.22, 1.13 ms     | 1.38, 1.03, 0.72, 0.74 ms     |

Canonical path resolution remained below `0.31 ms` in every sample. On the
larger Fragments checkout, recursive file discovery—not content hashing—is the
dominant repeated cost. The next optimization should therefore retain a
session-local file manifest before considering a hashing algorithm change.

## Excluded self-scan

The FlowAtlas repository root is not a valid architecture benchmark corpus in
its current form. Its `tsconfig.json` deliberately includes scanner fixtures
that model mutually contradictory and invalid source fragments. Aggregating
them as one application correctly trips a strict graph invariant. The
benchmark reports that failure rather than suppressing it; Fragments and Redux
Essentials provide two valid real checkouts instead.
