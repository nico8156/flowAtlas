# FlowAtlas Roadmap

This document separates delivered work from exploration and long-term
direction. It is a roadmap, not an implementation checklist or authorization
to start future work.

FlowAtlas remains driven by real code, focused fixtures and one TDD checkpoint
at a time. A future item becomes actionable only when the human collaborator
selects its RED.

## Status At A Glance

| Area                                                  | Status                         |
| ----------------------------------------------------- | ------------------------------ |
| Milestone 1 - Core graph                              | Delivered                      |
| Milestone 2 - Static TypeScript / Redux understanding | Advanced, still being extended |
| Milestone 3 - Complete Fragments Like architecture    | Next priority                  |
| Milestones 4-10                                       | Directional roadmap            |

The current repository contains a framework-independent `ArchitectureGraph`, a
focused TypeScript/Redux Toolkit scanner, 49 automated tests and two Fragments
acceptance projections. The visualizer and CLI do not exist yet.

## Delivered History

### Core Graph TDD

- [x] RED 1-6 - Empty graph, identifiable nodes, independent nodes, directed
      edges, `RelationKind` and `NodeKind`
- [x] RED 7-10 - Validate the four canonical relation directions
- [x] RED 11-13 - Reject missing endpoints and preserve node identity
- [x] RED 14 - Preserve source location on a relation
- [x] RED 15-16 - Support downstream and upstream navigation

### Static Scanner TDD

- [x] RED 17-18 - Detect one or multiple `createAction` Events
- [x] RED 19-20 - Detect listeners and statically identifiable dispatches
- [x] RED 21-22 - Detect reducer/state relationships and Event source locations
- [x] RED 23-25 - Resolve cross-file, renamed and aliased symbols
- [x] RED 27-31 - Resolve aliased listeners, dispatches, `createReducer`, store
      State identity and `addCase` updates
- [x] RED 32-35 - Ignore unresolved references, remove file-order dependence and
      preserve visible store State identity
- [x] RED 37-45 - Detect and resolve External abstractions, bounded internal
      orchestration, routed gateway possibilities and function-like declarations

The numbering intentionally preserves the historical gaps. The commit history
contains the detailed sequence of micro-cycles.

### Acceptance And Structural Work

- [x] RED 26 - Fragments Like optimistic slice
- [x] RED 36 - Fragments Like outbox/worker/External slice
- [x] Structural refactor - split scanner orchestration, detectors, resolvers
      and scanner test suites
- [x] Acceptance integration - version the Fragments projections with a
      configurable `FLOWATLAS_FRAGMENTS_ROOT`
- [x] Documentation pass - align doctrine, README and this roadmap with the
      delivered system

Acceptance tests are projections of the full graph. They assert relevant nodes,
edges and important absent edges; they do not reject additional topology that
is statically justified elsewhere in the corpus.

## Milestone 1 - Core Graph

**Status: delivered.**

Delivered capabilities include:

- `ArchitectureGraph` as the canonical model;
- identifiable nodes and unique node identity;
- `Event`, `Handler`, `State` and `External` node kinds;
- `LISTENS_TO`, `DISPATCHES`, `UPDATES` and `CALLS_EXTERNAL` relation kinds;
- source/target kind and endpoint invariants;
- upstream/downstream neighbor traversal;
- source locations on graph elements;
- asynchronous gaps represented as valid graph disconnections.

The graph is not a stored linear Flow structure. A flow remains a traversal or
projection of the graph.

## Milestone 2 - Static TypeScript / Redux Understanding

**Status: advanced, still being extended.**

The current adapter supports a deliberately constrained subset:

- `createAction` Events;
- direct and locally aliased listeners;
- `DISPATCHES` from statically identifiable action creators;
- `createSlice`, `createReducer` and `builder.addCase` State updates;
- relative imports, renamed imports and configured `tsconfig` aliases;
- multi-file scanning independent of input file order;
- function-like resolution for declarations, arrows and function expressions;
- External gateway discovery and bounded propagation through helpers;
- safe omission of unresolved dispatch and reducer relations.

The scanner structure is now explicit: source/project orchestration, separate
detectors, function resolution, External resolution and project symbol
resolution. No intermediate fact model or generic call graph has been added.

Acceptance coverage currently includes:

1. UI intent -> optimistic update -> Like State;
2. optimistic command -> outbox -> worker -> `LikeWlGateway`.

## Milestone 3 - Complete Fragments Like Architecture

**Status: next priority.**

The objective is to reconstruct the principal statically observable branches of
the real Like use case without inventing distributed causality.

Already covered:

1. UI / optimistic update;
2. outbox / worker / External boundary.

Next branch to study:

```text
projection.updated
    -> projectionSyncListenerFactory
    -> likesRetrieval
    -> LikeWlGateway.get
    -> likesRetrieved
    -> lState
```

### Open Design Issue: thunk dispatch

The real code dispatches the thunk `likesRetrieval` from the projection sync
Handler. The thunk is architecturally close to a Handler, not an Event.

We must not automatically:

- create a `Handler -> Handler` edge;
- misuse `DISPATCHES` with a Handler target;
- turn every thunk into an Event;
- infer a causal link merely because the names or files are related.

Options to study, without adopting one yet:

- represent the thunk as a Handler and introduce a dedicated relation;
- treat the thunk dispatch as orchestration detail and attach its observable
  consequences to the architectural trigger;
- introduce a Command/Intent concept only if it appears in multiple real cases;
- retain the transition in evidence and expose a simplified projection.

The next RED must be derived from the real source after this question is
resolved. It is not yet a fixed sequence of implementation tasks.

### Candidate REDs

These are the next probable behaviours, not scheduled work:

1. Detect `projection.updated` as an `Event` with `external-protocol` provenance.
2. Recognize the infrastructure callback or projection listener as a Handler.
3. Define the smallest truthful representation of the `likesRetrieval` trigger.
4. Detect `LikeWlGateway.get` as a `CALLS_EXTERNAL` consequence.
5. Produce `likesRetrieved --UPDATES--> lState`.

The candidate list must be revisited after each real-code investigation.

## Milestone 4 - Evidence And Trust

**Status: future direction.**

Once the Like branches are sufficiently covered, strengthen explanations for
why the graph contains a relationship:

- structured edge provenance;
- direct versus routed/transitive evidence;
- source symbol and source location;
- unresolved references as non-blocking diagnostics;
- an explanation of “why is this edge here?”.

Analysis complexity may live in evidence while the primary map remains small.

## Milestone 5 - Graph Projections

**Status: future direction.**

Formalize the projections already used by acceptance tests:

- downstream and upstream projections;
- depth limits;
- node-kind and region filters;
- scenario/subgraph projections;
- explicitly forbidden or speculative edges.

Do not introduce a linear `Flow` structure. `ArchitectureGraph` remains the
canonical model.

## Milestone 6 - CLI Productization

**Status: future direction.**

When the scanner is credible on real codebases, build the product entry point:

```text
npx flowatlas .
```

Possible follow-up commands include `scan`, `inspect`, `downstream`,
`upstream`, JSON export and Mermaid export. The CLI must consume application
capabilities and never contain analysis logic.

## Milestone 7 - Visualizer MVP

**Status: future direction.**

The first visualizer should consume `ArchitectureGraph` and support search,
focus, upstream/downstream exploration, zoom, filters, an inspector, source
locations and evidence. It must not define or mutate the domain model.

The success criterion is understanding a real architectural slice faster than
manual source navigation.

## Milestone 8 - Broader Validation

**Status: future direction.**

After Fragments Like, validate the scanner on another real Fragments flow and a
second Redux Toolkit application. This should reveal which assumptions are
generic and which are specific to Fragments. Do not expand to Zustand or XState
before this validation.

## Milestone 9 - Diagnostics

**Status: future direction.**

With several real codebases mapped, investigate orphan Events, Handlers without
observable consequences, cycles, highly connected States, unresolved
architectural relations and hotspots. Do not invent metrics before real cases
justify them.

## Milestone 10 - Runtime Overlay

**Status: long term.**

The static graph answers:

> What can happen?

An optional runtime layer may answer:

> What actually happened?

Potential signals include `correlationId`, `causationId`, `commandId`,
`traceId`, executed edges and branches not taken. Runtime and static evidence
must remain visually and conceptually distinct; runtime must never hide static
limitations.

## Escalation Rules

### Intermediate Facts Or Representation

Do not introduce an intermediate fact model while the current resolvers and
detectors compose correctly.

Re-evaluate only if one or more of these signals appears:

- several detectors reconstruct the same temporary information;
- propagation logic becomes materially duplicated;
- evidence or diagnostics must retain facts currently discarded;
- real acceptance gaps repeatedly show the same information loss between
  analysis steps.

If introduced, the model must remain an internal analysis detail and must not
become a second public graph model without a separate product reason.

### New Graph Vocabulary

Do not add a `NodeKind` or `RelationKind` to solve one syntax pattern or one
fixture. A new concept must:

- appear in multiple real architectural cases;
- explain useful architecture rather than implementation syntax;
- preserve the small, trustworthy V1 graph language;
- be introduced through an explicit RED and reviewed product vocabulary.

## Working Rules

- Future items are proposals, never implicit implementation permission.
- Every new scanner capability needs a minimal fixture and real-code validation.
- Acceptance projections must remain non-exhaustive views of the graph.
- Asynchronous gaps and unresolved relationships are valid results.
- Each TDD cycle follows RED, GREEN, refactor review, final verification,
  commit and push according to `AGENTS.md`.
