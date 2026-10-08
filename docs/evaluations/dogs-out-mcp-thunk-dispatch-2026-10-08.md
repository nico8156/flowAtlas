# MCP context: explicit async-thunk dispatches

Date: 8 October 2026. Iteration: **BEHAVIOUR**.
Route: a local TypeScript detector correction serving the existing MCP tools.
Status: **DELIVERED — MCP async-thunk dispatch restriction closed**.

## Observable outcome and acceptance boundary

`flowatlas_get_context` for Dogs Out `loadOnboarding` must expose the resolved
slice action Events explicitly dispatched by its payload creator, and the
States those Events update. The previous MCP replay returned only lifecycle
Events, the onboarding State and two injected ports.

The first example is a typed thunk importing a slice action under an alias.
The response must connect `Handler --DISPATCHES--> Event --UPDATES--> State`,
while omitting unresolved action calls, actions dispatched by another thunk,
and invented lifecycle-to-State updates. A second fixture projection checks
that resolution sources outside scan scope do not create graph endpoints.

The real acceptance uses the MCP client/server protocol with the actual
TypeScript project loader and scanner. It requires `loadOnboarding` dispatches
to `dogsLoaded`, `onboardingCompleted` and `becameAnonymous`, the `dogSlice`
and `authenticationSlice` States, and the existing gateway/vault boundaries.
It rejects an invented `loadOnboarding.fulfilled → dogSlice` update and a
`loadOnboarding → dogSelected` dispatch: the latter belongs to a different
thunk in the pinned corpus.

No new node/relation vocabulary, port, facts model or public request/response
schema is needed. The gap is a detector omission classified `AUTO`.

## RED and minimum GREEN

Before production changes, both commands failed on the missing MCP relations:

```sh
npx vitest run tests/mcp/asyncThunkContext.test.ts --maxWorkers=1 --minWorkers=1
npx vitest run tests/acceptance/dogsOutMcpOnboarding.test.ts --maxWorkers=1 --minWorkers=1
```

RED Inspector: **PASS**. The fixture returned only lifecycle Events; Dogs Out
returned its old seven-node/eight-edge projection. The expected dispatches
are explicit source calls, not inferred runtime causality.

The minimum implementation invokes the existing dispatch-body resolver from
the async-thunk payload-creator branch, with the handler's import bindings.
This preserves alias identity and existing strict graph/scope rules. Helpers
and arbitrary functions are not added as graph nodes.

GREEN Inspector: **PASS**. The two initial MCP examples passed after this
seven-line change. A scope-exclusion regression then passed on the restored
implementation. Local test setup was extracted to avoid duplicating MCP
connection/cleanup code; production needed no structural refactoring.

## Targeted mutation evidence

Baseline and restored-code verification:

```sh
npx vitest run tests/mcp/asyncThunkContext.test.ts --maxWorkers=1 --minWorkers=1
```

Both fixture tests passed. Two manual mutations were executed independently
in `src/scanner/listenerDetector.ts`, restoring the exact added block after
each run:

| Mutation                                                                             | Result     | Behavioral evidence                                                        |
| ------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------- |
| Remove the added `addDispatchRelationshipsFromBody` call from the async-thunk branch | **KILLED** | The positive MCP test loses the dispatched aliased action and its State.   |
| Replace `bindings` with `new Map()` in that added call                               | **KILLED** | The positive MCP test loses the canonical Event behind the imported alias. |

Each mutant compiled and ran; each failed the expected projection assertion,
not setup or compilation. No selected mutant survived. The scope-exclusion
test passed under both mutants; it protects a different existing invariant.
Final local verification passed both tests after restoration. No mutation is
included in the final diff.

## Built MCP replay

Source baseline: FlowAtlas `48f7ebf` plus this cycle's changes.
Corpus: Dogs Out `8858c30a19f34ac891819d119073f29ef770ab2b`; the mobile
worktree has no source changes. Concurrent backend and delivery-documentation
changes were observed at final inspection and preserved; the whole Dogs Out
worktree is not claimed clean.
After `npm run build`, a fresh stdio MCP process was started at the same
configured executable path, `node {FLOWATLAS_ROOT}/dist/mcp.js`.
It received:

```json
{
  "projectPath": "{DOGS_OUT_ROOT}/mobile",
  "nodeId": "loadOnboarding",
  "direction": "both",
  "maxDepth": 3,
  "maxNodes": 40,
  "maxEdges": 80,
  "maxBytes": 16384
}
```

The fresh process returned **13 nodes, 15 edges, 4,408 serialized bytes**,
`complete=true`, `frontierComplete=true`, and application coverage
`not-assessed`. The three expected direct dispatches were present alongside
the lifecycle dispatches. The previous configured-MCP replay returned
**7 nodes, 8 edges, 2,787 bytes** with the same request.

The additional `dogsLoaded --UPDATES--> slice` relation is statically justified:
`src/features/walkActivity/state/walkActivitySlice.ts` resets its State on
`dogsLoaded` through `extraReducers.addCase`. The current scanner uses that
file's declaration identifier `slice` as the State id. The acceptance is a
non-exhaustive projection and does not remove this additional valid relation.

This is a static architecture improvement: conditions and runtime ordering
are not encoded by these edges. A running MCP process retains its loaded
JavaScript, so an existing connection must be restarted to load the new build.

## Verification scope and remaining restrictions

The full relevant regression scope passed: **40 files, 124 tests, no skips**.
It covers MCP, scanner, graph/application projections, Dogs Out acceptances
and the relevant Fragments graph/MCP acceptances:

```sh
npx vitest run tests/scanner tests/mcp tests/domain tests/application tests/acceptance/dogsOut* tests/acceptance/fragmentsLike.test.ts tests/acceptance/fragmentsOutbox.test.ts tests/acceptance/fragmentsProjection.test.ts tests/acceptance/fragmentsProfileListenerScoping.test.ts tests/acceptance/mcpAgentContext.test.ts tests/acceptance/reduxEventFactory.test.ts --maxWorkers=1 --minWorkers=1
```

`npm run typecheck`, `npm run lint`, `npm run format` and `npm run build` passed.
CLI/TUI/browser feature work is outside this iteration. The verification claim
is for this relevant regression scope, not a full-repository test run.

This closes the cross-slice async-thunk dispatch gap recorded by the
[milestone 1 replay](dogs-out-mcp-replay-2026-10-08.md). That historical
transcript is retained unchanged. Java request maintenance, the isolated Java
projection Handler context and the complete authentication coordinator path
remain separate MCP restrictions. They are not started by this cycle.
