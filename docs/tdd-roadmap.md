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
| 7B. Agent context interfaces               | DELIVERED: autonomous CLI and MCP         |
| 8. Broader validation                      | PROPOSED                                  |
| 9. Diagnostics                             | LONG TERM                                 |
| 10. Runtime overlay                        | LONG TERM                                 |

## Completed Investigation: TypeScript Program / TypeChecker

**Status: DELIVERED — selective production adoption**

The TypeScript adapter now shares compiler AST creation, while FlowAtlas still
owns fallback import/path resolution, semantic indexes and bounded
architectural propagation. The observed Fragments baseline is
approximately 342 TypeScript files. Historical direct-scan measurements were
approximately 22 seconds after the import-path index optimization; the latest
CLI baseline measured approximately 9.74 seconds on the same local setup.
Worker execution was previously approximately 26–29 seconds. These numbers
must be treated as machine/run dependent; the acceptance suite is slower
because it rescans the same project several times.

The current investigation compares that approach with a TypeScript compiler
context:

```text
tsconfig -> Program -> SourceFiles + TypeChecker
                         -> FlowAtlas detectors
```

The first spike is intentionally isolated in
`scripts/typeScriptProgramSpike.mjs`. It measures Program creation and
selected semantic queries against the real Fragments project. It does not
change `ArchitectureGraph`, detectors or scanner semantics.

The comparison covers:

- renamed import identity: local alias -> original symbol -> declaration;
- homonymous declarations: symbol identity versus name-based fallback;
- `LikeWlGateway` type and `get` method resolution in `likesRetrieval`;
- the outbox path, where TypeScript can resolve declared types but FlowAtlas
  still owns bounded propagation through gateway selection and helper calls.

The working hypothesis is **selective adoption of `Program + TypeChecker`**,
not a generic TypeScript analyzer. TypeScript may replace manual symbol,
alias, declaration and interface lookup. FlowAtlas must retain architectural
interpretation, scan-scope decisions, bounded external propagation and the
strict/tolerant graph boundary. No intermediate facts model, generic call
graph, persistent cache or incremental program is introduced by this spike.

The investigation is complete. TypeScript owns program, symbol, alias,
declaration and interface semantics where its identity is reliable. FlowAtlas
retains architectural interpretation, scan scope, bounded External propagation
and the strict/tolerant graph boundary.

### Delivered implementation

The first production slice is delivered: an in-memory compiler host now builds
one `Program` per scan, and the resolver/project scanner reuse its `SourceFile`
instances. The `TypeChecker` is created and retained internally, but detectors
have not yet been migrated to it. Fragments acceptance remains green (113
tests); the latest direct scan measured approximately 8.51 seconds versus
9.74 seconds before this slice on the same local setup. Treat this as an
initial signal, not a controlled benchmark.

The first such migration is now delivered for imported Event bindings:
`TypeChecker` unwraps renamed imports to their original declaration, while the
existing path resolver remains a tolerant fallback. The complete suite remains
green at 113 tests. A subsequent direct Fragments scan measured approximately
8.73 seconds; this is considered run-to-run noise relative to the previous
8.51-second measurement.

External interface method support is now checker-backed when available. The
semantic index reads interface properties from the declared TypeScript type
and retains AST member collection as fallback. The full suite remains green at
113 tests; the latest direct scan measured approximately 8.65 seconds, which
does not establish a meaningful performance change.

Bounded External type-alias lookup now consults the shared semantic index
before its AST fallback. The latest direct Fragments scan measured
approximately 6.02 seconds. A full-suite run exposed an existing race between
parallel CLI acceptance tests and `tsup` cleaning `dist`; `cliScan` passes when
run after a completed build. This tooling issue remains separate from the
checker migration.

Optional phase instrumentation is now available with
`FLOWATLAS_PROFILE=1`. A Fragments run measured approximately 2.01 seconds for
compiler-context construction and 2.41 seconds for the relationship pass; the
remaining measured phases were below 0.21 seconds each, with a total scan of
approximately 6.08 seconds. The next performance decision must focus on those
dominant phases rather than add isolated resolver caches.

Detector-level profiling now isolates `listenerDetector` at approximately
2.65 seconds of the relationship pass on Fragments; External, Event and State
detectors are each below 20 ms. The next performance investigation should
trace repeated resolution work from listeners before changing the compiler
context again.

Listener sub-phase profiling isolated External resolution inside listener
effects at approximately 1.64 seconds; discovery, dispatch, infrastructure
and thunk handling were each around 1–6 ms. A scan-scoped cache now reuses
repeated bounded return-value and helper-call resolutions. The same Fragments
profile measured approximately 0.81 seconds for listener External resolution
and 6.5 seconds for the total scan. The cache is private to one scan, does not
persist facts and does not alter graph semantics. Nested propagation remains
architectural analysis, not a generic data-flow cache or facts model.

### Decision and limits

The selective migration is accepted. It improves symbol correctness and
reduces repeated listener External resolution without adding a generic
analyzer. The remaining dominant cost is compiler-context construction, whose
measurement varies between runs. No persistent cache, incremental/watch
program, intermediate facts model or generic call graph is justified.

Further work in this area requires a new real acceptance gap or a measured
regression. The next product work should not be blocked on completing a
hypothetical full TypeChecker rewrite.

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
- shared TypeScript import-path indexing, avoiding a full project path-set
  rebuild for every import resolution;
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
- a real Fragments Ticket projection is covered by deterministic layered
  layout, viewport and density invariants;
- Map pan and density changes preserve the projected node/edge set and
  selection.
- `f`, `u` and `d` request focus, upstream and downstream projections through
  callbacks supplied by the CLI;
- `Esc` restores presentation-only projection history;
- NodeKind filters operate after projection and remove incident edges without
  reconnecting hidden nodes.
- the TUI renders an `ANALYZING PROJECT` shell before the graph loader starts;
- the real graph transitions the TUI to `READY`, preserving the requested
  initial node and all existing interactions;
- controlled loading failure renders a readable TUI error state.
- the project scan runs in a dedicated Node worker and can be cancelled when
  the TUI exits during analysis.
- cyclic real-project projections are layout-safe; terminal Map edges expose
  their canonical relation kind so `LISTENS_TO`, `DISPATCHES`, `UPDATES` and
  `CALLS_EXTERNAL` remain distinguishable.
- a presentation-only `Neighborhood` layout can isolate a selected node and
  its directly connected territory while preserving the projection edges.
- the interactive TUI can switch between `territory` and `Neighborhood`
  representations with `t` and `n`, without changing the Inspector or graph
  semantics.
- the ready-state TUI displays one full-screen screen at a time, with Map as
  the default, `/`/`e` opening Explorer, `Enter` returning to Map and `i`
  opening Inspector.
- the loading state also uses one full-screen screen instead of the legacy
  three-column shell.
- Explorer kind filters use `e`, `h`, `s` and `x`: the first key narrows the
  list to that kind, additional keys compose the visible set, and pressing
  the last active kind or `0` restores all kinds.
- Long Explorer lists use a bounded visible window with a range indicator;
  `j/k` scroll the window while keeping the cursor visible.
- Reopening Explorer with `e` resets its search and kind filters, providing a
  predictable starting point for the next exploration.
- Explorer selection with `Enter` returns to the Map, and its footer exposes
  the kind filters plus `0 all` reset explicitly.
- The Map `r` action shows the direct Handlers that dispatch the selected Event
  through a depth-one upstream projection.
- The Map no longer exposes spatial pan controls. Its viewport is reserved for
  clipping and selection visibility; Neighborhood remains stable and focused.
- The active Map pane fills the available terminal height, including blank
  space, so short projections remain inside one stable full-screen surface.
- The terminal Map applies the Monokai NodeKind palette and a distinct
  selection marker without changing the underlying projection.
- Branched Neighborhood relations use explicit vertical connectors before
  their target segments, keeping multiple relation labels readable without
  inventing edges.
- Map nodes are rendered as the top visual layer so edge strokes cannot
  overwrite node identities or the selected marker.
- Compact Map density shortens relation labels for readability while normal
  and detailed densities retain the canonical relation names.
- Selection is derived against the current visible projection before render,
  preventing empty or unmarked Map frames during node and projection changes.
- Selecting a node from Explorer enters Neighborhood automatically; Territory
  remains an explicit full-projection view via `t`.

### Known gaps

The browser implementation is not the M7 product target. The TUI still needs:

- Explorer, Map and Inspector panes with responsive terminal sizing;
- a Map representation that uses the available terminal width without asking
  users to navigate horizontally;
- more expressive edge routing when branches become dense;
- a visual review on a full-size real Fragments terminal session;
- TTFG on the full Fragments project remains measurable: the direct scan is
  currently about 22 seconds and the worker round trip about 29 seconds on the
  development machine. TTFF and TTFG are intentionally separate metrics; the
  worker keeps the TUI responsive while TTFG is in progress.
- a visual review on a full-size real Fragments terminal session after the
  graph becomes ready.
- validate the interactive `Neighborhood` representation on a real Fragments
  projection and assess whether the reduced territory improves readability.
- improve the full-screen `Neighborhood` layout and add temporary Explorer and
  Inspector overlays if the real terminal review confirms they are needed.
- enter the terminal alternate screen at startup and restore the user's shell
  cleanly on `q`, error and interrupt.

### Before-layout evidence

The existing non-interactive rendering of the real Ticket slice was a flat
list:

```text
Nodes: five ids
Relations: four labels
```

It contained no coordinates, no branch separation, no viewport and no density
state. This justified a presentation-only layered layout and viewport rather
than a change to `ArchitectureGraph` or its projections.

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

The current layout is deterministic and layered left-to-right. It is an
adapter concern and does not attempt to solve arbitrary edge crossing.

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

## Milestone 7B - Agent Context Interfaces

**Status: DELIVERED — autonomous CLI and ephemeral MCP validated**

### Goal

Let coding agents build a small, trustworthy architectural context on demand
without receiving the complete graph. FlowAtlas establishes statically
justifiable architecture; the agent decides how to explore and modify the
source.

The target dependency direction is:

```text
ArchitectureGraph
      -> application discovery and context projection
            -> CLI adapter
            -> MCP adapter
```

MCP is a delivery mechanism, not a new analysis or graph model. The CLI and
MCP adapters must expose the same application behavior rather than implement
parallel search, traversal or truncation rules.

### Acceptance drivers

The first driver is a real Fragments use case whose architectural entry point
is not supplied in advance. A consumer must be able to:

1. find a small deterministic set of candidate nodes from a query;
2. request a focused, depth-limited JSON projection from one candidate;
3. locate the referenced source files;
4. distinguish a complete projection from one limited by an explicit budget;
5. deepen exploration from a frontier node without receiving the full graph.

After the CLI contract is usable, compare equivalent coding-agent tasks with
and without FlowAtlas. Record at least files opened, search commands, context
size, missed architectural relations, incorrect hypotheses and final test
results. Token counts are useful when available but are not required for the
first evaluation.

The MCP driver follows only after that evaluation: a local MCP client must be
able to discover a node, request its context and inspect it with results
equivalent to the CLI on the same checkout.

### Proposed application capabilities

Candidate capabilities are independent from their transport:

```text
findArchitectureNodes(query, filters, limit)
buildArchitectureContext(nodeId, direction, limits)
inspectArchitectureNode(nodeId)
```

The initial CLI shape may expose them as:

```text
flowatlas find <query> [path] --kind <kind> --limit <count> --json
flowatlas context <nodeId> [path] --direction <direction> --depth <count> --json
```

Exact argument ordering and defaults remain acceptance decisions. The first
JSON context contract should be versioned and contain the focus, request,
projection and source locations. It must preserve canonical edge directions;
the requested traversal direction is separate metadata.

### Context bounds and truthfulness

Depth alone may not bound a highly connected territory. Node and edge budgets
are candidates after observing a real wide projection:

```text
--max-nodes <count>
--max-edges <count>
```

When a budget is reached, the result must not silently imply that the returned
projection is exhaustive. A context envelope may report:

- whether the requested traversal completed within its limits;
- the applied depth, node and edge limits;
- returned node and edge counts;
- frontier nodes with known neighbors that were not expanded.

The frontier describes projection coverage, not new architecture. It must use
canonical `RelationKind` values plus a separate traversal direction; it must
not introduce inverse relations such as `LISTENED_BY` into the graph.

A provider-specific `maxTokens` option is excluded initially. Deterministic
node and edge budgets validate contextual selection without coupling the core
to a model tokenizer. A byte-size budget may be evaluated later if measured
serialization size becomes a problem.

### Deterministic discovery

Initial node discovery is limited to existing graph information: node id,
kind, provenance and source path. Exact, prefix, word and substring matches
may be ranked deterministically with lexical tie-breaking.

Discovery must not infer `Feature`, `UseCase`, package ownership or semantic
similarity from directory names. Source paths may be searchable metadata
without becoming hierarchy in `ArchitectureGraph`. Embeddings and LLM-based
ranking are outside this milestone.

### MCP delivery

The first MCP adapter may expose:

```text
flowatlas_find_nodes
flowatlas_get_context
flowatlas_inspect_node
```

The MCP SDK remains at the adapter boundary. The domain and scanner must not
depend on MCP, and the server must not reinterpret results produced by the
application capabilities.

The first vertical preferred freshness over optimization and rescanned for
every architectural request. Repeated MCP requests then provided the evidence
for a separate architecture decision: the process may retain one verified
graph snapshot, but must reload and fingerprint the complete scanner input
before every reuse. A changed source set or TypeScript configuration rebuilds
the graph synchronously; a failed verification or rebuild must never fall back
to stale architectural data. This does not authorize a watcher, TTL,
incremental TypeScript Program or persisted graph.

### Known gaps

- focused CLI projections other than `context` produce human-oriented text;
- projection traversal currently scans graph edges rather than using public
  adjacency indexes;
- the package is private and is not yet installable from npm as a normal
  project development dependency;
- no measured coding-agent comparison currently establishes context savings;
- no benchmark yet quantifies the scan-time reduction from the verified MCP
  snapshot on a large checkout;

### Decisions

- Option B is selected: application capabilities precede transport adapters.
- `ArchitectureGraph` remains the only canonical architecture model.
- Agent context is a versioned application output over a graph projection,
  not a stored `Flow`, facts model or new domain vocabulary.
- Full-graph export is not the primary agent workflow.
- The CLI validates the context contract before MCP productization.
- MCP is justified by tool discovery and structured access; persistence is
  justified separately by measured repeated-scan cost.
- MCP session reuse retains one graph only after verifying the canonical
  project root and a content-derived fingerprint of the complete scanner input;
  it never relies on elapsed time or file timestamps.
- Missing static causality remains missing and is never repaired for agent
  convenience.
- Bounded contexts use breadth-first distance, case-insensitive lexical node
  identity within each layer and atomic induced-graph additions; traversal
  stops before the first addition that exceeds a node or edge budget.
- Adjacency indexes are reconstructible implementation details and will be
  introduced only if a large-corpus benchmark justifies them.

### Delivered capabilities

- `context <nodeId> [path] --direction <upstream|downstream|both> --depth
<count> --json` exports a versioned focused projection;
- the application context keeps traversal request metadata separate from
  canonical graph edge directions;
- the real Fragments Like event acceptance preserves source locations, known
  relations and the requested depth boundary.
- `find <query> [path] --kind <kind> --limit <count> --json` returns versioned,
  deterministically ranked node candidates;
- discovery uses existing node ids, kinds, provenance and source paths without
  inferring features, use cases or semantic similarity;
- the real Fragments acceptance proves stable filtering, ranking, limiting and
  source-location output for Like Events.
- optional `context --max-nodes --max-edges` budgets stop a deterministic
  breadth-first traversal before the first addition that would exceed either
  limit;
- bounded contexts preserve the induced graph between returned nodes and
  expose completion, returned counts and canonical relations crossing the
  unexplored frontier;
- the real Fragments `lState` acceptance proves that an edge budget can stop
  before the node budget without silently hiding an internal relation.
- a repository-owned Codex exploration skill now selects `find` only when the
  entry point is unknown, requests bounded `context`, reads referenced sources
  and preserves explicit architectural gaps;
- an ephemeral read-only Codex treatment selected FlowAtlas without being
  prompted to do so and reconstructed the canonical Like territory;
- the first paired observation is recorded in
  `docs/evaluations/codex-autonomous-exploration.md`: autonomy succeeded, but
  the treatment consumed more tokens and opened more files than the control.
- a local `stdio` MCP adapter exposes exactly `flowatlas_find_nodes` and
  `flowatlas_get_context`, delegating to the existing application capabilities;
- a real Fragments protocol acceptance proves MCP initialization, tool
  discovery, structured results and exact equivalence with application output;
- the initial `flowatlas-mcp` composition root scanned the requested checkout
  afresh for every tool call;
- Codex now prefers the configured MCP tools and falls back to the CLI only
  when MCP is unavailable or fails;
- a paired change-oriented observation measured 210,109 MCP input tokens
  versus 269,046 through the CLI, approximately 21.9% fewer, while preserving
  the same architectural gaps;
- a same-session freshness check observed a newly declared Event on the second
  request without restarting the MCP server;
- both MCP change-oriented runs repeated the same context request, exposing a
  concrete scan-cost driver for the next persistence architecture review.
- the resulting verified-snapshot loader now reuses one session-local graph
  when project identity and scanner-input content are unchanged, rebuilds after
  a source or configuration change, isolates project roots and propagates
  rebuild failures instead of serving stale data.

### Discovered micro-cycles

The complete autonomous agent-context path is delivered through CLI and MCP.
Its evaluation is recorded in
`docs/evaluations/codex-mcp-exploration.md`. The retained-session review selected
a content-verified, single-snapshot loader at the MCP composition boundary.
This decision does not pre-authorize persistent storage, incremental compiler
state, TTL caches or graph-index changes.

### Open design questions

- Should discovery and context remain separate CLI scans, or should a single
  command support query-to-context after the baseline is measured?
- What repeated change-oriented evidence threshold demonstrates that FlowAtlas
  materially improves an agent task beyond identifier correctness?
- What large-checkout benchmark demonstrates the effective scan-time reduction
  of verified snapshot reuse?
- How should project roots and multiple TypeScript configurations be selected
  without changing node identity or scan-scope semantics?

### Completion criteria

The milestone is complete when a coding agent can discover and progressively
explore a bounded real architectural territory through both CLI and MCP; both
adapters return equivalent, versioned, explicitly complete-or-truncated
results; the agent reads referenced sources before editing; and measured tasks
show a useful exploration benefit without changing graph vocabulary,
inventing causality or serving stale architectural truth.

## Milestone 8 - MCP Hardening

**Status: DELIVERED**

### Goal

Make the validated MCP vertical robust under filesystem aliases, source
changes, failures, concurrent requests and protocol errors without changing
the canonical graph or adding speculative caching.

### Acceptance driver

A long-lived local MCP session repeatedly queries a temporary TypeScript
checkout while its identity, contents and availability change.

### Decisions

- Hardening preserves the content-verified snapshot contract selected after
  the MCP evaluation.
- Equivalent filesystem paths must identify the same physical checkout.
- Errors must never be hidden by a previously retained graph.

### Discovered micro-cycles

- Physical project roots are resolved before snapshot comparison, so a direct
  path and a symbolic link to the same checkout reuse one verified graph.

### Known gaps

- same-session creation, deletion and `tsconfig.json` changes are not yet
  covered through the complete MCP protocol;
- concurrent request behavior has not been stress-tested;
- protocol-level failures need explicit acceptance coverage;
- stdout/stderr separation is not verified at process level.

### Completion criteria

The server preserves fresh static truth across project mutations and failures,
avoids redundant work for equivalent checkout identities, remains protocol
clean and has deterministic behavior under concurrent requests.

## Milestone 9 - Broader Validation

**Status: DELIVERED**

### Goal

Separate generic FlowAtlas capabilities from Fragments-specific conventions.

### Acceptance driver

The official `reduxjs/redux-essentials-example-app` tutorial implementation,
pinned at the evaluated commit and supplied through an optional local checkout.

### Decisions

- The Redux Essentials default branch is not a valid corpus because it is only
  a non-Redux tutorial scaffold; validation uses `tutorial-steps-ts`.
- The first projection is limited to an explicit `createAction`, its registered
  State and a statically visible reducer matcher.
- RTK Query lifecycle callbacks and WebSocket boundaries are outside the scope
  of this Redux-only validation and are not assigned new graph meaning.
- A Redux async thunk is modeled as a Handler dispatching its statically
  guaranteed `pending`, `fulfilled` and `rejected` lifecycle Events. Payload
  creator calls are outside this Redux-only decision.

### Discovered micro-cycles

- A reducer imported from `export default slice.reducer` now resolves to its
  slice declaration, allowing the State to use its `configureStore` key.
- A local `isAnyOf` matcher passed to `addMatcher` now contributes only its
  explicitly resolved Events to `UPDATES`; generated matcher expressions remain
  omitted.
- `extraReducers` object methods are traversed like equivalent property
  callbacks, making the first official notification projection GREEN without
  changing State or Event semantics.
- Handwritten thunk factories now retain their exact source location; the
  official notification thunk is found as an isolated Handler without inventing
  a dispatch relation absent from its body.
- Direct `createAsyncThunk` declarations now produce one Handler, three
  lifecycle Events and their canonical `DISPATCHES` relations.
- Typed async thunk factories are resolved through their imported symbol back
  to an exact `createAsyncThunk.withTypes()` declaration, without name-based
  inference.
- Project-local `tsconfig` path aliases are resolved against the loaded virtual
  sources before external TypeScript resolution, allowing the official typed
  thunk factory import to preserve its declaration identity.
- Exact async thunk lifecycle property accesses passed to `addCase` resolve to
  an existing canonical Event, completing the official auth State projection
  without accepting unresolved property names.

### Known gaps

- The corpus listener middleware is triggered only by a generated RTK Query
  endpoint matcher. It is intentionally excluded from this Redux-only
  milestone because no explicit Event exists to justify `LISTENS_TO`.

### Completion criteria

The scanner's reusable assumptions are documented before considering other
framework adapters, and several independent Redux Essentials projections pass
without inventing causality for generated RTK Query behavior.

## Milestone 10 - Reproducible Technical Benchmark

**Status: DELIVERED**

### Goal

Measure the effective cost reduction of the verified MCP snapshot on real,
pinned TypeScript corpora without conflating it with agent token usage or task
quality.

### Acceptance driver

A repository command runs several graph requests against one unchanged
checkout and emits a machine-readable report that distinguishes the first
scan from repeated content verification.

### Decisions

- The benchmark exercises the same project loader, scanner and verified
  snapshot composition used by the MCP server.
- Every request reloads and fingerprints the current sources; repeated
  requests may skip only the architecture scan.
- Wall-clock results include environment and graph-size metadata and are
  observations, not universal performance guarantees.
- Agent effectiveness, token consumption and MCP transport overhead remain
  separate evaluations.

### Known gaps

- The FlowAtlas repository root cannot serve as one application corpus because
  its test fixtures intentionally contain contradictory source fragments. This
  failure remains visible rather than weakening graph invariants.

### Discovered micro-cycles

- The repository-owned `benchmark:mcp` command now runs the exact
  verified-snapshot composition and
  emits a versioned JSON report with raw samples, environment, graph size and
  scan count.
- The runner rejects fewer than two iterations, separating the first request
  from a median over repeated verified loads.
- On the recorded machine, five requests performed one scan for both Fragments
  and Redux Essentials. The observed first-to-repeated-median ratios were
  17.45x and 165.01x respectively.
- Fragments replaces the invalid FlowAtlas self-scan as the second real corpus;
  the reason and the failed invariant are documented rather than hidden.

### Completion criteria

The benchmark is test-driven, emits deterministic JSON fields, runs on both
Fragments and the pinned Redux Essentials corpus, records reproducible commands
and raw samples, and verifies that unchanged repeated requests perform one scan
without weakening freshness guarantees.

## Milestone 11 - Justified Optimizations

**Status: ACTIVE**

### Goal

Reduce repeated MCP graph-loading latency using benchmark evidence while
preserving the default content-verified freshness contract and keeping cache
state outside `ArchitectureGraph`.

### Acceptance driver

A retained MCP session repeatedly queries an unchanged real checkout, then
observes a source creation, modification, deletion and configuration change
without returning stale architectural truth.

### Decisions

- Optimization starts with phase-level measurements, not speculative scanner
  changes.
- `verified-content` remains the default. Metadata-only verification may be
  evaluated only as an explicit weaker mode.
- File manifests, hashes and timestamps are infrastructure snapshot data and
  never enter the canonical graph.

### Discovered micro-cycles

- The benchmark now separates configuration read, recursive file discovery,
  source read, project fingerprint, graph scan and path canonicalization.
- On Fragments, repeated recursive discovery consumed roughly `264-362 ms`,
  compared with `13-21 ms` for source reads and `18-26 ms` for fingerprinting.
  Manifest discovery is therefore the first justified optimization target.
- On Redux Essentials, the same phases remained small; this confirms that the
  optimization must preserve a low fixed cost for small repositories.
- An opt-in metadata-verified project loader retains the deterministic source
  manifest and loaded project inside the MCP infrastructure boundary. The
  default remains content verification.
- An unchanged metadata manifest avoids source reads. A detected creation,
  deletion or modification rebuilds the project while rereading only added or
  metadata-changed files and reusing unchanged source objects.
- A detected `tsconfig.json` metadata change reloads the configuration before
  the full graph scan.
- A seven-request Fragments comparison observed a repeated median of
  `1621.78 ms` in content mode versus `552.13 ms` in metadata mode, about 66%
  lower on the recorded machine.
- Concurrent requests for the same canonical project root now share one
  in-flight load and scan. A shared failure reaches every waiter, is never
  cached and leaves the next request free to retry.
- The MCP composition retains up to four independently verified project graphs
  in deterministic least-recently-used order. Revalidation refreshes recency;
  exceeding the bound evicts the least recently queried root.

### Known gaps

- Both modes still rediscover source paths on every request so creations and
  deletions remain observable without a watcher.
- Metadata mode retains source content rather than a separate per-file hash
  index; the measured fingerprint cost is currently much smaller than manifest
  discovery and does not justify another cache representation.
- Metadata-only verification cannot guarantee freshness when content changes
  while size and timestamps are preserved.

### Completion criteria

The phase report remains reproducible; session-local snapshot data avoids
unnecessary discovery and reading in an explicitly selected mode; content,
creation, deletion and `tsconfig` changes invalidate as promised; and real
corpus measurements demonstrate the trade-off without changing graph meaning.

## Milestone 12 - Diagnostics

**Status: LONG TERM**

Potential areas include orphan Events, Handlers without observable outcomes,
cycles, highly connected States, unresolved architectural relations and
hotspots. Do not invent metrics before real cases justify them.

## Milestone 13 - Runtime Overlay

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
