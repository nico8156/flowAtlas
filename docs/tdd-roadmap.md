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

## Near-Term Candidate Behaviours

Only the next explicitly selected RED is actionable. These candidates are not
scheduled work:

- [ ] RED 7 - Validate `LISTENS_TO` from `Handler` to `Event`
- [ ] RED 8 - Validate `DISPATCHES` from `Handler` to `Event`
- [ ] RED 9 - Validate `UPDATES` from `Event` to `State`
- [ ] RED 10 - Validate `CALLS_EXTERNAL` from `Handler` to `External`

## Later Direction

These items preserve the intended direction without freezing the design or
authorizing implementation:

- RED 11 - Reject an edge whose source is not in the graph
- RED 12 - Reject an edge whose target is not in the graph
- RED 13 - Define the behavior for duplicate node identities
- RED 14 - Preserve source location on a relation
- RED 15 - Support `downstream`
- RED 16 - Support `upstream`
- RED 17 - Detect one `createAction` Event from a TypeScript fixture

The scanner acceptance track begins only after the graph invariants and
navigation behavior have emerged from tests. The Fragments Like golden graph
remains the later acceptance target.

## Current State

The last completed cycle is RED/GREEN #6. Its accepted behaviour is that an
architectural node carries one of the canonical FlowAtlas node kinds, while
node-kind semantics remain independent from relation-kind semantics.

The repository is idle until the next RED is explicitly chosen.
