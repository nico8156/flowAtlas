# FlowAtlas TDD Roadmap

This file records completed TDD work and possible next behaviours. It is not an
implementation checklist or authorization to advance cycles. The next RED is
always explicitly selected by the human collaborator and follows `AGENTS.md`.

## Completed History

### Domain Graph

- [x] RED 1 - Create an empty `ArchitectureGraph`
- [x] RED 2 - Add one identifiable node
- [x] RED 3 - Preserve multiple independent nodes
- [x] RED 4 - Add a directed edge between existing nodes
- [x] RED 5 - Give an edge a `RelationKind`
- [x] RED 6 - Give a node a `NodeKind`
- [x] RED 7 - Validate `LISTENS_TO` from `Handler` to `Event`
- [x] RED 8 - Validate `DISPATCHES` from `Handler` to `Event`
- [x] RED 9 - Validate `UPDATES` from `Event` to `State`
- [x] RED 10 - Validate `CALLS_EXTERNAL` from `Handler` to `External`
- [x] RED 11 - Reject an edge whose source is absent
- [x] RED 12 - Reject an edge whose target is absent
- [x] RED 13 - Preserve one node per identity
- [x] RED 14 - Preserve source location on a relation
- [x] RED 15 - Support `downstream`
- [x] RED 16 - Support `upstream`

### TypeScript Scanner

- [x] RED 17 - Detect one `createAction` as an `Event`
- [x] RED 18 - Detect multiple actions in one source
- [x] RED 19 - Detect `startListening({ actionCreator })`
- [x] RED 20 - Detect `dispatch(actionCreator())`
- [x] RED 21 - Detect reducer/state construction
- [x] RED 22 - Preserve source location on a detected Event
- [x] RED 23 - Aggregate a simple cross-file topology
- [x] RED 24 - Preserve Event identity through a renamed import
- [x] RED 25 - Resolve aliases against homonymous module symbols
- [x] RED 27 - Detect a Handler registered through a local listener alias
- [x] RED 28 - Detect dispatches inside an aliased listener effect
- [x] RED 29 - Detect `createReducer` as a State construction
- [x] RED 30 - Resolve State identity from store registration
- [x] RED 31 - Detect `addCase` as an Event-to-State update
- [x] RED 32 - Ignore unresolved dispatched Events safely
- [x] RED 33 - Ignore unresolved reducer Events safely
- [x] RED 34 - Make project scanning independent of file order
- [x] RED 35 - Prefer the visible store State identity

### Acceptance And External Resolution

- [x] RED 26 - Reconstruct the first real Fragments Like slice as a graph
      projection, including optimistic updates and the asynchronous gap
- [x] RED 36 - Reconstruct the real Fragments Like outbox slice
- [x] RED 37 - Detect an External abstraction
- [x] RED 38 - Detect a Handler call to an External
- [x] RED 39 - Traverse internal orchestration to an External
- [x] RED 40-44 - Resolve External propagation, object bindings, routed
      commands, discriminated gateway possibilities and cross-file orchestration
- [x] RED 45 - Resolve function declarations and function-like variables
      uniformly
- [x] Structural refactor - separate scanner orchestration, detectors,
      function resolution, External resolution and scanner test suites
- [x] Documentation/integration - version Fragments acceptance tests with a
      configurable corpus root

The numbered history intentionally preserves gaps and grouped micro-cycles
where the implementation evolved through several focused tests. The commit
history remains the detailed record.

## Current Capabilities

The scanner currently supports a deliberately limited TypeScript/Redux Toolkit
subset:

- `createAction` Event detection;
- direct and locally aliased listener registration;
- `DISPATCHES` from statically identifiable action creators;
- `createSlice` and `createReducer` State detection;
- `builder.addCase` `UPDATES` relationships;
- relative imports, renamed imports and configured `tsconfig` aliases among
  provided files;
- source file/line locations for detected Events;
- External gateway detection and bounded propagation through internal helpers;
- source and multi-file project scanning with order-independent results.

Every capability has focused fixtures and the relevant acceptance slices are
validated against the real Fragments corpus when it is available.

## Next Investigation

The next real branch is projection/SSE to retrieval:

```text
projection.updated
    -> projectionSyncListenerFactory
    -> likesRetrieval
    -> LikeWlGateway.get
    -> likesRetrieved
    -> lState
```

The modeling question is intentionally open. `likesRetrieval` is a thunk or
Handler dispatched from another Handler. FlowAtlas must not invent a
`Handler -> Handler` edge, misuse `DISPATCHES` with a Handler target, or turn a
thunk into an Event automatically. The source evidence and the smallest useful
architectural vocabulary must be studied before defining the next RED.

Possible future work is only directional until selected:

- projection/SSE external-protocol Event detection;
- retrieval/thunk architectural representation;
- additional Fragments projection acceptance coverage;
- diagnostics, CLI and visualizer after the static model is trustworthy.

Runtime correlation, additional frameworks and a generic call graph remain out
of scope.
