# FlowAtlas

> Explore your architecture.

FlowAtlas transforms an event-driven codebase into a navigable architecture
map.

It is built around one principle:

> **FlowAtlas is an architecture map, not a call graph.**

When a Redux Toolkit application grows, its actions, listeners, reducers,
thunks, gateways and asynchronous workers remain distributed across a codebase.
The code may still be well organized, but the global behavior becomes hard to
see. FlowAtlas is intended to make that architecture visible without requiring
runtime instrumentation or application code changes.

## Project status

FlowAtlas currently combines a focused static TypeScript scanner with a CLI
exploration path and an active terminal visualizer MVP. The scanner can
reconstruct the Like, outbox and projection slices of the real Fragments
application. The browser visualizer remains available as a secondary adapter;
M7 is now focused on a keyboard-first terminal experience.

| Area                            | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| TypeScript / Node.js foundation | Available                                                |
| Strict type checking            | Available                                                |
| Test runner and build pipeline  | Available                                                |
| Architecture graph model        | V1 core and graph projections available                  |
| TypeScript analysis             | Focused TypeScript project scanner                       |
| Redux Toolkit detectors         | Limited V1 patterns available                            |
| CLI                             | MVP scan, graph exploration and Terminal Map in progress |
| Interactive visualizer          | M7 active: CLI/TUI primary, browser secondary            |
| Fragments acceptance tests      | Available when the corpus is present                     |

The domain graph and analysis capabilities emerge through acceptance-driven
TDD. The repository includes acceptance tests for the Fragments Like, outbox
and projection slices. The Fragments application itself remains an external
corpus and is not copied into this repository.

The CLI currently supports:

```sh
npx flowatlas scan .
npx flowatlas inspect <nodeId> .
npx flowatlas downstream <nodeId> .
npx flowatlas upstream <nodeId> .
npx flowatlas scan --json .
npx flowatlas focus <nodeId> .
npx flowatlas tui <nodeId> .
```

The browser adapter can still be run locally with:

```sh
npm run visualizer
```

It opens a browser prototype where a serialized graph exported by
`flowatlas scan --json .` can be loaded and explored.

The terminal map is the current product direction. The existing focused CLI
presentation renders a bounded territory directly in the terminal and does not
require the browser adapter:

```sh
npx flowatlas focus uiLikeToggleRequested .
```

The interactive TUI is available for a focused territory:

```sh
npx flowatlas tui uiLikeToggleRequested .
```

It provides Map, Explorer and Inspector as full-screen application screens. Map
is the default; `/` or `e` opens Explorer, `Enter` returns to Map with the
selected node, and `i` opens Inspector. `Esc` returns to Map. In Explorer,
`j/k`, arrows and search select nodes. The Map is intentionally not
user-pannable: its viewport is reserved for clipping and keeping the selected
territory visible. `+/-` changes presentation density, `n` shows the selected node's
`Neighborhood`, and `t` restores the full territory representation. It
consumes the existing graph projection and `f/u/d` request focus, upstream and
downstream projections through the CLI application boundary. It does not add
traversal or analysis logic to the terminal adapter.

The Map uses a Monokai-inspired palette while retaining `[E]`, `[H]`, `[S]`
and `[X]` markers: Events are cyan, Handlers pink, States green, Externals
orange, relation labels muted and the selected marker violet.
When a node has several outgoing relations, the Map uses a vertical branch
connector before each horizontal target segment so relation labels remain
separate and directional.
Node labels are rendered above edge strokes, so connectors cannot overwrite a
selected node or truncate its architectural identifier.

Explorer filters use `e` (Events), `h` (Handlers), `s` (States) and `x`
(Externals). From the full list, the first letter narrows the list to that
kind; additional letters add kinds to the visible set. Pressing the last
active kind restores all kinds, and `0` always restores the full list.
Long Explorer lists are rendered through a bounded window and show their
visible range; `j/k` scroll the window while keeping the cursor visible.
Press `Enter` on the cursor to select that node and return to the Map. The
Explorer footer exposes `1/2/3/4` kind filters and `0 all` to restore the full
list.
Opening Explorer again with `e` resets its search and kind filters so each
exploration starts from the complete visible node list.
From the Map, `r` shows the Handlers that dispatch the selected Event.

The terminal map is being extended with presentation modes. The first mode is
`Neighborhood`: a selected node and its directly connected architectural
territory, without changing the underlying graph or projection semantics.

The TUI starts with a single full-screen `ANALYZING PROJECT` state before the
TypeScript project and graph are available, then switches to `READY` when the
real graph has been built. No placeholder graph is displayed. The scan runs
in a worker, so the terminal remains responsive and `q` can cancel an
in-progress scan. The full project may still take time to become interactive
while its graph is built.

To run those tests, point `FLOWATLAS_FRAGMENTS_ROOT` at a local checkout of
Fragments. The default is `../fragmentsCleanFront` relative to the repository:

```sh
FLOWATLAS_FRAGMENTS_ROOT=../fragmentsCleanFront npm test
```

When the corpus is unavailable, the acceptance suites are reported as skipped;
the focused scanner and domain suites remain runnable from a clean checkout.

## Development workflow

A real acceptance test drives a milestone. Its observed gaps produce the
smallest useful micro-cycles:

```text
acceptance RED
    -> Gap Inspector
    -> micro RED / RED Inspector
    -> GREEN
    -> Refactor Inspector
    -> verification
    -> commit / push
    -> replay acceptance
```

Human review is reserved for product and architecture decisions. Local
mechanical cycles can proceed automatically when the existing model and
invariants are sufficient. Detailed workflows live in:

- `.codex/skills/tdd-cycle/SKILL.md`
- `.codex/skills/acceptance-slice/SKILL.md`
- `.codex/skills/scanner-development/SKILL.md`
- `.codex/skills/architecture-review/SKILL.md`
- `.codex/skills/documentation-roadmap/SKILL.md`

## Product direction

The initial user is a frontend developer maintaining a medium-to-large Redux
Toolkit codebase.

The intended entry point is:

```sh
npx flowatlas .
```

The CLI is the door into the product. The product itself is the visual map:

- search for an architectural element;
- focus on an event, handler, state or external boundary;
- explore known upstream and downstream relationships;
- understand independent branches and asynchronous gaps;
- inspect the source location behind a node or edge.

The map should help answer questions such as:

- What reacts to this event?
- Which state areas can this event update?
- Which external boundaries does this handler cross?
- Which events and handlers can lead to this state mutation?
- Which relationships are known, and which are not statically observable?

## Canonical graph

The canonical structure is an `ArchitectureGraph` made of nodes and edges.
It is deliberately independent from Redux, TypeScript AST tooling, the
filesystem, the CLI and UI frameworks.

### Node kinds

V1 exposes four visual node families:

| Kind       | Meaning                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `Event`    | Something was requested or happened.                                   |
| `Handler`  | Something reacts to a trigger and coordinates transitions.             |
| `State`    | An architectural state area that is mutated.                           |
| `External` | A meaningful execution or persistence boundary outside the local flow. |

An event is not limited to a Redux action. Its provenance may be retained as
metadata, for example:

- `redux`;
- `external-protocol`;
- `internal`.

A handler is not limited to a Redux listener. Its nature may be retained as
metadata, for example:

- `redux-listener`;
- `thunk`;
- `use-case`;
- `worker`;
- `infrastructure-callback`.

### Edge kinds

V1 uses a small, directional vocabulary:

```text
Handler --LISTENS_TO----> Event
Handler --DISPATCHES-----> Event
Event   --UPDATES--------> State
Handler --CALLS_EXTERNAL-> External
```

Edges are stored with this canonical direction but must be traversable in both
directions by the application. The visualizer may render a relationship in the
direction that best communicates a scenario.

There is no `TRIGGERS` edge in V1. A callback, worker or protocol adapter can
still express a reaction through `LISTENS_TO` when the source evidence justifies
it.

## Architectural truth

FlowAtlas must prefer an incomplete but trustworthy graph over a complete graph
built from guesses.

The scanner must not infer relationships from:

- names that merely look related;
- neighboring files or folders;
- timing assumptions;
- optimistic UI conventions;
- asynchronous or distributed correlation that is not present in source code.

For example, an optimistic write and a later projection refresh may converge on
the same state without forming one statically observable flow. That gap is valid
architecture and must remain visible rather than being hidden by a guessed edge.

Every relationship should retain evidence such as the source construction,
symbol and source location. Dynamic or unresolved behavior should be omitted in
V1 rather than presented as certain.

## First acceptance scenario

The first real acceptance target is the Like architecture in
`/fragmentsCleanFront`.

The real code does not contain an artificial `likeRequested -> listener ->
accepted` chain. It contains at least two independent branches:

```text
uiLikeToggleRequested
    -> likeToggleUseCase
    -> likeOptimisticApplied / unlikeOptimisticApplied
    -> likes state
    -> enqueueCommitted
    -> outbox state
    -> outboxProcessOnce
    -> processOutbox
    -> LikeWlGateway
```

And independently:

```text
projection.updated
    -> projection sync routing
    -> likesRetrieval
    -> LikeWlGateway
    -> likesRetrieved
    -> likes state
```

The golden graph will capture the exact nodes, edges, source evidence and
intentionally absent relationships from that codebase. It must not invent a
causal link between the optimistic/outbox branch and the projection branch.

## Current Scanner Scope

The scanner is deliberately limited. Given TypeScript source containing
declarations such as:

```ts
const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
```

`scanTypeScriptSource` and `scanTypeScriptProject` currently support:

- `createAction` Event nodes, including multiple actions and source locations;
- direct and locally aliased `startListening` Handler registrations;
- statically identifiable `dispatch(actionCreator())` relationships;
- `createSlice`, `createReducer` and `builder.addCase` State relationships;
- relative imports, renamed imports and configured `tsconfig` aliases;
- External gateway detection and bounded propagation through internal
  orchestration;
- order-independent multi-file scanning.

This is not full TypeScript program resolution. Complex monorepos, generated
code, workspace boundaries, dynamic dispatch and arbitrary call graphs remain
out of scope.

Redux Toolkit is the first analysis target because its conventions provide
useful static signals. It is an adapter, not the FlowAtlas domain model.

Initial analysis scope:

- TypeScript projects;
- one `tsconfig.json`;
- relative imports;
- TypeScript path aliases;
- renamed imports;
- simple re-exports and barrels where feasible;
- `createAction`;
- `createSlice`;
- `builder.addCase`;
- `startListening({ actionCreator })`;
- statically identifiable `dispatch(actionCreator())` calls.

Explicitly out of scope for the first version:

- complex monorepos;
- multiple independent TypeScript projects;
- cross-workspace symbol resolution;
- generated code;
- speculative async correlation;
- runtime tracing;
- Redux Saga;
- Redux Observable;
- Zustand, XState and other adapters;
- a full call graph;
- line-by-line execution visualization.

## Scanner Structure

The TypeScript adapter is split by responsibility:

```text
typeScriptScanner.ts       public facade
sourceScanner.ts           one source input
projectScanner.ts          project orchestration
eventDetector.ts           Event patterns
listenerDetector.ts        Handler/listener, dispatch and External edges
stateDetector.ts           State and reducer patterns
externalDetector.ts        External abstractions
functionResolver.ts        function-like symbol resolution
externalResolution.ts      bounded External propagation
projectSymbolResolver.ts   imports and aliases
```

The domain graph remains independent from TypeScript, Redux Toolkit and the
filesystem.

## Granularity rule

The primary map represents architectural transitions, not implementation
mechanics.

The following are not first-class nodes by default:

- helpers;
- mappers;
- builders;
- selectors;
- ordinary utility calls;
- internal implementation functions;
- routing helpers with no independent architectural responsibility.

An element belongs in the primary graph only when it helps explain the
architecture. Otherwise it remains evidence or metadata for a later detail
view.

## Architecture boundaries

FlowAtlas follows Hexagonal Architecture and Clean Architecture without
creating layers for their own sake.

The dependency rule is:

```text
delivery adapters       -> application / domain
analysis adapters       -> application / domain
infrastructure adapters -> application / domain
application / domain    -> no adapter or framework
```

Planned responsibilities:

- **Domain**: architectural concepts and graph rules;
- **Application**: use cases such as graph construction and traversal;
- **Primary adapters**: CLI first, visualizer later;
- **Secondary adapters**: TypeScript project analysis and filesystem access.

The repository will create these directories when their first real behavior is
introduced. Empty architectural layers are intentionally not scaffolded.

## Development workflow

This project uses strict, discussion-driven TDD.

Each behavior follows this sequence:

1. Choose the smallest next behavior.
2. Write exactly one readable behavioral test.
3. Run that test.
4. Confirm that it fails for the expected reason.
5. Stop and review the design pressure created by the RED.
6. Implement the minimum behavior required for GREEN.
7. Run the tests and inspect the result.
8. Stop again before selecting the next behavior.

No batch of RED/GREEN cycles should be performed without an intermediate
review. Tests should prefer real objects and named fakes over generalized
mocking. They should describe capabilities and architectural rules, not private
implementation details.

## Local commands

Install dependencies:

```sh
npm install
```

Run the available checks:

```sh
npm run typecheck
npm test
npm run build
npm run lint
npm run format
```

Run tests in watch mode:

```sh
npm run test:watch
```

The repository contains focused domain and scanner tests plus optional
Fragments acceptance tests. Acceptance scenarios assert a relevant graph
projection, not equality with the complete graph; additional justified edges
must remain available.

## Repository layout

The current layout is intentionally small:

```text
src/
  domain/        framework-independent architecture graph
  scanner/       TypeScript analysis adapter
tests/
  domain/        graph behavior
  scanner/       detector and resolution fixtures
  acceptance/    optional Fragments projections
```

The project is private during development. Publishing, the executable CLI and
the visualizer will be introduced only when they represent real user-facing
capabilities.

## Roadmap

1. Resolve how a thunk/Handler dispatched by another Handler belongs in the
   architectural vocabulary without inventing a `Handler -> Handler` edge.
2. Extend the Fragments acceptance coverage only when a real architectural
   gap is identified.
3. Build the first navigable visual map.

Diagnostics, runtime overlays and additional architecture adapters come later.
They must not weaken the static truth guarantees of the MVP.

## License

MIT. The package is private while FlowAtlas is under active development.
