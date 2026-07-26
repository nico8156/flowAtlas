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

FlowAtlas is currently at the first TypeScript analysis stage.

| Area                            | Status                          |
| ------------------------------- | ------------------------------- |
| TypeScript / Node.js foundation | Available                       |
| Strict type checking            | Available                       |
| Test runner and build pipeline  | Available                       |
| Architecture graph model        | Minimal V1 core available       |
| TypeScript analysis             | Minimal `createAction` detector |
| Redux Toolkit detectors         | Not started                     |
| CLI                             | Not started                     |
| Interactive visualizer          | Not started                     |
| Fragments acceptance fixture    | Not started                     |

The domain graph and analysis capabilities are emerging through the TDD
workflow described below. The current repository contains only a minimal
TypeScript source scanner; it intentionally contains no CLI, visualizer or
Fragments acceptance fixture yet.

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

## Scope of the first adapter

The first scanner capability is deliberately small. Given TypeScript source
containing declarations such as:

```ts
const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
```

`scanTypeScriptSource` can produce an `Event` node whose id is derived from the
declared symbol. It can also detect a simple `startListening` declaration and
produce its `Handler` plus `LISTENS_TO` edge. The current AST traversal also
preserves multiple simple `createAction` declarations found in one source
input. This capability is source-in/source-out and is not yet a project
scanner or CLI command.

It does not yet resolve imports, aliases, barrels or symbols across files, and
it does not detect slices or dispatches. Listener detection currently requires
the event declaration and listener registration to be statically identifiable
in the same source input.

The next vertical detector capabilities are planned in this order:

1. `startListening({ actionCreator })` to connect a `Handler` to an `Event`;
2. `dispatch(actionCreator())` to produce a `DISPATCHES` edge;
3. `builder.addCase` to produce an `Event` to `State` update;
4. source locations and then multi-file symbol resolution.

Each step is developed through one RED/GREEN/REFACTOR cycle and validated with
a focused fixture before being applied to the Fragments acceptance scenario.

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

The bootstrap currently has no domain tests, so the test command succeeds with
an explicit no-test configuration. This will be replaced by the first RED test
when implementation begins.

## Repository layout

The current layout is intentionally small:

```text
src/
  index.ts       technical package entry point only
tests/           created with the first behavioral test
```

The project is private during development. Publishing, the executable CLI and
the visualizer will be introduced only when they represent real user-facing
capabilities.

## Roadmap

1. Define the first smallest domain behavior through a RED test.
2. Build the minimal graph model required by that behavior.
3. Add graph traversal and evidence rules.
4. Add the TypeScript analysis port and the smallest detector needed by a fixture.
5. Validate each detector with a minimal fixture and then against Fragments.
6. Add the CLI scan entry point.
7. Build the first navigable visual map.
8. Add the Fragments Like golden acceptance test.

Diagnostics, runtime overlays and additional architecture adapters come later.
They must not weaken the static truth guarantees of the MVP.

## License

MIT. The package is private while FlowAtlas is under active development.
