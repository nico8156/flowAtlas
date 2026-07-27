# FlowAtlas TDD Roadmap

This file records the TDD history and possible next behaviours for FlowAtlas.

It is not an implementation checklist or an authorization to advance cycles.
The next behaviour must always be explicitly selected by the human collaborator
and developed according to `AGENTS.md`.

## Completed

- [x] RED 1 - Create an empty `ArchitectureGraph`
- [x] RED 2 - Add one identifiable node
- [x] RED 3 - Preserve multiple independent nodes
- [x] RED 4 - Add a directed edge between existing nodes
- [x] RED 5 - Give an edge an architectural relation kind
- [x] RED 6 - Give a node an architectural node kind
- [x] RED 7 - Validate `LISTENS_TO` from `Handler` to `Event`
- [x] RED 8 - Validate `DISPATCHES` from `Handler` to `Event`
- [x] RED 9 - Validate `UPDATES` from `Event` to `State`
- [x] RED 10 - Validate `CALLS_EXTERNAL` from `Handler` to `External`
- [x] RED 11 - Reject an edge whose source is not in the graph
- [x] RED 12 - Reject an edge whose target is not in the graph
- [x] RED 13 - Define the behavior for duplicate node identities
- [x] RED 14 - Preserve source location on a relation
- [x] RED 15 - Support `downstream`
- [x] RED 16 - Support `upstream`
- [x] RED 17 - Detect one `createAction` Event from a TypeScript fixture
- [x] RED 19 - Detect `startListening({ actionCreator })`
- [x] RED 20 - Detect `dispatch(actionCreator())` from a Handler
- [x] RED 22 - Preserve source location on a detected Event
- [x] RED 23 - Aggregate a simple cross-file topology
- [x] RED 24 - Preserve Event identity through a renamed import
- [x] RED 25 - Resolve aliased imports against homonymous module symbols
- [x] RED 27 - Detect a Handler registered through a local listener alias
- [x] RED 28 - Detect dispatches inside an aliased listener effect
- [x] RED 29 - Detect `createReducer` as a State construction

## Near-Term Candidate Behaviours

Only the next explicitly selected RED is actionable. These candidates are not
scheduled work:

- RED 30 - Resolve the visible State identity from store registration
- RED 31 - Detect `addCase` as an Event-to-State update

## Later Direction

The scanner acceptance track has now started with a source-in/source-out
detector. The Fragments Like graph is now the director acceptance test. It
remains RED while micro-cycles #28 through #31 add the missing capabilities.

The intended vertical detection path is:

```text
createAction
-> startListening
-> dispatch
-> builder.addCase
-> source locations
-> imports and symbol resolution
-> Fragments acceptance slices
```

Each capability must be validated with a minimal fixture before it is
validated against the real Fragments codebase. Acceptance gaps may remain RED
while smaller capability cycles reduce them.

## Current State

The last completed cycle is RED/GREEN #29. The graph now has the minimal V1
vocabulary, validates the four relation direction/kind combinations, rejects
edges whose referenced nodes are absent, preserves unique node identities, can
retain a file/line source location on an edge, and supports direct upstream and
downstream neighbor queries. The source scanner detects simple `createAction`
Events with source locations, direct and locally aliased listener registrations,
and simple `api.dispatch(actionCreator())` dispatch relationships. The scanner
can resolve relative imports and
configured `tsconfig` paths among provided source inputs, including homonymous
symbols. Full TypeScript program resolution, barrels and workspace boundaries
remain out of scope.
RED #11 and RED #12 required regression tests only because the existing
relation validation already rejected missing nodes as a consequence.

The repository is idle after RED/GREEN #29. The Fragments acceptance test
remains intentionally RED. The next selected micro-cycle is #30; acceptance
must be replayed after each completed capability cycle.
