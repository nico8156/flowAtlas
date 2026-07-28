# FlowAtlas Roadmap

The roadmap defines the destination. The acceptance defines the path. Micro
REDs build the path.

Future items are proposals, not implementation permission. Work remains
acceptance-driven and follows `.codex/skills/tdd-cycle/SKILL.md`.

## Status At A Glance

| Milestone                                  | Status                                    |
| ------------------------------------------ | ----------------------------------------- |
| 1. Core graph                              | DELIVERED                                 |
| 2. Static TypeScript / Redux understanding | DELIVERED for the current Fragments scope |
| 3. Complete Fragments Like architecture    | PROPOSED                                  |
| 4. Evidence and trust                      | PROPOSED                                  |
| 5. Graph projections                       | DELIVERED                                 |
| 6. CLI productization                      | DELIVERED                                 |
| 7. Visualizer MVP                          | ACTIVE: CLI/TUI pivot                     |
| 7A. Terminal Map CLI                       | DELIVERED: absorbed into M7               |
| 8. Broader validation                      | PROPOSED                                  |
| 9. Diagnostics                             | LONG TERM                                 |
| 10. Runtime overlay                        | LONG TERM                                 |

## Delivered History

### Milestone 1: Core graph

- RED 1-6: empty graph, identifiable nodes, independent nodes, directed edges,
  `RelationKind` and `NodeKind`.
- RED 7-10: canonical relation direction invariants.
- RED 11-13: endpoint validation and node identity.
- RED 14: source location evidence.
- RED 15-16: downstream and upstream navigation.

### Milestone 2: Static TypeScript / Redux understanding

- RED 17-18: one and multiple `createAction` Events.
- RED 19-20: listeners and statically identifiable dispatches.
- RED 21-22: reducer/state relationships and source locations.
- RED 23-25: cross-file, renamed and `tsconfig` alias resolution.
- RED 27-31: aliased listeners, dispatches, `createReducer`, store State
  identity and `addCase` updates.
- RED 32-35: unresolved references, file-order independence and visible store
  State identity.
- RED 37-45: External discovery, bounded orchestration, routed gateway
  possibilities and uniform function-like resolution.
- RED 50-55: infrastructure callbacks, thunk gateway propagation, project
  context versus scan scope and shared resolution indexing.
- RED 56: semantic declaration index built once per scan and function-like
  resolver migration.
- Final Fragments projection fix: `AppThunkWl -> ThunkAction -> ExtraArgWl ->
DependenciesWl -> Partial<GatewaysWl> -> LikeWlGateway`.

### Acceptance drivers delivered

- RED 26: Fragments Like optimistic slice.
- RED 36: Fragments Like outbox/worker/External slice.
- RED 49: Fragments projection refresh slice, including
  `likesRetrieval --CALLS_EXTERNAL--> LikeWlGateway`.

The acceptance tests are projections of the complete graph. They assert
relevant nodes, edges and important absent edges, not exhaustive graph
equality.

## Milestone 1 - Core Graph

**Status: DELIVERED**

### Goal

Provide a framework-independent `ArchitectureGraph` with trustworthy nodes,
edges and bidirectional navigation.

### Acceptance driver

Domain behavioural tests for graph construction, invariants and navigation.

### Completion criteria

`ArchitectureGraph` is independent of TypeScript, Redux, filesystem, CLI and
UI; canonical V1 kinds and relations are explicit; invalid endpoints are
rejected; upstream/downstream traversal works.

## Milestone 2 - Static TypeScript / Redux Understanding

**Status: DELIVERED for the current Fragments scope**

### Goal

Translate a deliberately limited TypeScript/Redux Toolkit vocabulary into the
canonical graph without turning the scanner into a call graph.

### Acceptance driver

Fragments Like optimistic, outbox and projection slices: RED 26, RED 36 and
RED 49.

### Delivered capabilities

- `createAction`, listeners, dispatches and reducer/state updates;
- relative imports, renamed imports and configured aliases;
- order-independent multi-file analysis;
- function-like resolution and shared semantic indexing;
- External discovery and bounded propagation through internal helpers;
- tolerant omission of unresolved relations;
- distinction between project TypeScript context and architectural scan scope.

### Decisions

- `ArchitectureGraph` remains the only public architectural model;
- acceptance scenarios are projections, not complete graph equality;
- helpers remain metadata/analysis details;
- no intermediate facts model or generic call graph was introduced.

### Completion criteria

The three Fragments acceptance drivers pass, relevant unit/scanner suites are
green, and the static graph remains trustworthy under the current V1 scope.

## Milestone 3 - Complete Fragments Like Architecture

**Status: PROPOSED**

### Goal

Cover the principal statically observable branches of the real Like use case.

### Acceptance driver

Extend the existing Fragments Like acceptance only after inspecting the real
projection/SSE and retrieval code.

### Known gaps and open design question

The real code contains:

```text
projection.updated
    -> projectionSyncListenerFactory
    -> likesRetrieval
    -> LikeWlGateway.get
    -> likesRetrieved
    -> lState
```

The thunk `likesRetrieval` behaves architecturally like a Handler but is
dispatched by another Handler. Do not invent `Handler -> Handler`, misuse
`DISPATCHES` with a Handler target, or turn every thunk into an Event.

Possible models to investigate, without adopting one yet:

- a dedicated relation for Handler-to-Handler invocation;
- orchestration detail retained in evidence while consequences remain visible;
- a Command/Intent concept if repeated real cases justify it;
- a simplified projection with the transition omitted from the primary graph.

### Discovered micro-cycles

None scheduled. The next RED must be derived from the real code after the
design question is inspected.

### Completion criteria

The principal statically observable Like branches are covered without invented
causality, and the thunk transition has an explicit, reviewed representation.

## Milestone 4 - Evidence And Trust

**Status: PROPOSED**

### Goal

Make every important graph relationship explainable without expanding the
primary graph vocabulary.

### Candidate acceptance driver

A real graph relationship can expose source file, line, symbol, construct and
detection path.

### Candidate work

Structured provenance, direct versus routed evidence, unresolved diagnostics
and a "why is this edge here?" explanation.

### Completion criteria

Evidence is useful to developers and remains separate from primary graph
semantics.

## Milestone 5 - Graph Projections

**Status: DELIVERED**

### Goal

Formalize focused graph views without introducing a stored linear `Flow`.

### Acceptance driver

Real-node exploration from the Fragments Ticket graph in upstream and
downstream directions.

### Delivered capabilities

- downstream and upstream projections;
- depth-limited projections;
- node-kind filtering;
- projection immutability and endpoint-safe edge filtering;
- acceptance coverage on the real Ticket graph.

### Decisions

- `GraphProjection` is a view over `ArchitectureGraph`, not a persisted flow;
- projections preserve the canonical graph and return only visible nodes and
  edges;
- asynchronous gaps and absent relations remain absent from projections;
- region filtering remains a future concern because no region model is needed
  by the current product behavior.

### Completion criteria

Views remain projections over `ArchitectureGraph`, preserve bidirectional
exploration, and are validated against a real application graph.

## Milestone 6 - CLI Productization

**Status: DELIVERED**

### Goal

Provide the first usable product entry point:

```text
npx flowatlas .
```

### Acceptance driver

A controlled TypeScript project can be scanned and explored from the terminal
without CLI-specific analysis logic.

### Delivered capabilities

- `scan [path]` summary;
- `inspect <nodeId> [path]` with source and immediate relations;
- `downstream <nodeId> [path]` projection;
- `upstream <nodeId> [path]` projection;
- `scan --json [path]` graph export;
- deterministic non-zero errors for invalid nodes.

### Decisions

- the CLI is an adapter and delegates scanning, inspection and projections;
- JSON exports the canonical `{ nodes, edges }` graph shape;
- the CLI does not start a server, open a browser or own analysis logic;
- Mermaid export, watch mode and richer configuration remain future proposals.

### Completion criteria

The CLI is useful without a visualizer, keeps scanner logic out of the adapter
boundary and supports the first terminal exploration workflow.

## Milestone 7 - Visualizer MVP (CLI/TUI)

**Status: ACTIVE - product direction pivoted from browser to terminal**

### Goal

Make the map understandable directly from the terminal. The browser
visualizer remains a reusable secondary adapter/prototype; the primary M7
experience is a keyboard-first CLI/TUI.

### Acceptance driver

A developer understands a real architectural slice faster than by navigating
the source manually.

### Delivered capabilities

Delivered so far:

- controlled `ArchitectureGraph` rendering through the React visualizer;
- node search and selection;
- visual distinction and filtering by `NodeKind`;
- inspector with kind, source location and immediate relations;
- downstream and upstream territory exploration through `GraphProjection`.
- depth-limited downstream projections from the visualizer.
- depth-limited upstream projections from the visualizer.
- reset from a focused projection to the complete graph.
- viewport controls for zoom in, zoom out and fit view.
- relation visibility constrained to the active projection.
- explicit bidirectional territory focus from a selected node;
- bounded automatic territory focus when selecting a node;
- acceptance coverage rendering and inspecting a real Fragments-scanned graph.
- acceptance coverage exploring a real Fragments Ticket territory downstream.
- acceptance coverage exploring a real Fragments Ticket state territory upstream.
- acceptance coverage filtering a real Fragments graph by node kind.
- acceptance coverage displaying source locations from a real Fragments graph.
- acceptance coverage exposing viewport controls on a real Fragments graph.
- JSON graph deserialization is available for visualizer consumers.
- `ArchitectureMapFromJson` connects serialized graph input to the visualizer.
- local JSON file loading is available through `ArchitectureMapLoader`.
- a Vite browser shell is available through `npm run visualizer`;
- a real Fragments Ticket graph can be loaded and explored in both directions.
- `flowatlas focus` renders a bounded terminal territory without a browser;
- the first controlled TUI presentation session renders node-kind markers,
  relations, search results, selection and an inspector.
- `flowatlas tui <nodeId> [path]` launches the interactive Ink shell;
- the TUI acceptance covers the three panes, pane switching, search, keyboard
  selection and inspector synchronization.

### Known gaps

The browser implementation is not the M7 product target. The TUI still needs:

- Explorer, Map and Inspector panes with responsive terminal sizing;
- a terminal map layout with readable directions and selected-node emphasis;
- focus/upstream/downstream commands wired to the existing projections;
- discrete density/zoom and pan state;
- a real Fragments terminal acceptance slice.

The earlier browser run also exposed product-level readability issues that
remain relevant to any renderer:

- the selected node inspector must show only relations connected to the
  selected node and must not display stale or unrelated relations;
- duplicate architectural edges must not be presented as duplicate visual
  facts;
- the initial map needs a readable focused layout rather than a flat grid of
  all nodes;
- relation labels and the Explorer/Map/Inspector regions need enough visual
  structure to support navigation;
- focused navigation must remain consistent between the rendered projection
  and the inspector.

These are visualizer/application concerns. They must not be solved by changing
the canonical graph vocabulary or inventing new architectural relationships.

### Completion criteria

The TUI consumes `ArchitectureGraph` and existing projections without defining
their model. A developer can launch FlowAtlas in a terminal, search and select
nodes, inspect kind/source/relations, focus a territory, explore both
directions, pan and adjust density on a readable real architectural slice.

The browser adapter may remain available, but it is not required to complete
M7.

## Milestone 7A - Terminal Map CLI (historical)

**Status: DELIVERED / absorbed into M7**

### Goal

Provide a fast terminal-first architecture map for focused territories. This
slice established the CLI presentation boundary now being extended into the
interactive TUI.

### Acceptance driver

```text
flowatlas focus <nodeId> <path>
```

On a supported TypeScript fixture, the command must render the selected node,
its focused architectural territory and canonical relation labels without
requiring a browser or manual JSON file loading.

### Constraints

- consume `ArchitectureGraph` and graph projections only;
- keep scanner and domain logic out of the CLI renderer;
- use deterministic plain text when output is not a TTY;
- add ANSI colors only as terminal presentation;
- do not introduce a `Flow` model or new graph vocabulary;
- keep full-graph rendering out of the initial terminal experience.

### Completion criteria

`flowatlas focus` is covered by a real CLI acceptance test, renders a useful
focused projection, supports bounded depth, handles unknown nodes cleanly and
remains compatible with pipes and CI output.

## Milestone 8 - Broader Validation

**Status: PROPOSED**

### Goal

Separate generic FlowAtlas capabilities from Fragments-specific conventions.

### Acceptance driver

Another real Fragments flow, followed by a second Redux Toolkit application.

### Completion criteria

The scanner's reusable assumptions are documented before considering other
framework adapters.

## Milestone 9 - Diagnostics

**Status: LONG TERM**

Potential areas include orphan Events, Handlers without observable outcomes,
cycles, highly connected States, unresolved architectural relations and
hotspots. Do not invent metrics before real cases justify them.

## Milestone 10 - Runtime Overlay

**Status: LONG TERM**

The static graph answers "What can happen?". A separate runtime layer may
answer "What actually happened?" through correlation IDs, executed edges and
branches not taken. Runtime evidence must never hide static limitations.

## Escalation Rules

### Intermediate facts

Do not introduce an IR/facts model while resolvers and detectors compose. Re-
evaluate only if several detectors reconstruct the same temporary information,
propagation is materially duplicated, evidence needs discarded facts, or real
acceptance gaps repeatedly show the same information loss.

### New graph vocabulary

A new NodeKind or RelationKind must appear in multiple real cases, explain
architecture rather than syntax, preserve the small V1 language and be
introduced through an explicit reviewed RED.

## Working Rules

- Every scanner capability needs a minimal fixture and real-code validation
  when possible.
- Acceptance projections are non-exhaustive views of the graph.
- Asynchronous gaps and unresolved relationships are valid results.
- Micro-cycles are discovered from acceptance gaps, not pre-authorized by a
  long list of future REDs.
- A completed cycle is verified, committed and pushed before the next cycle.
