# AGENTS.md — FlowAtlas Engineering Doctrine

## Purpose

FlowAtlas is a developer tool that turns event-driven software architecture into a navigable map.

Its purpose is to help developers understand architectural relationships that are difficult to perceive by navigating source files individually.

The foundational product principle is:

> **FlowAtlas is an architecture map, not a call graph.**

Everything in this repository must preserve that distinction.

---

# 1. Product Model

The canonical model of FlowAtlas is an architecture graph.

It is not a linear flow model.

Conceptually:

```ts
ArchitectureGraph {
  nodes
  edges
}
```

A flow is only a traversal, projection, or view over this graph.

The graph does not assume:

- a unique starting point;
- a unique ending point;
- synchronous execution;
- continuous causality;
- a single scenario.

Asynchronous gaps are valid architecture.

FlowAtlas must never invent relationships simply to make a scenario appear complete.

---

# 2. Architectural Vocabulary

The V1 primary node kinds are:

- Event
- Handler
- State
- External

## Event

Something happened or was requested.

An Event is an architectural concept, not necessarily a Redux action.

Possible origins include:

- Redux;
- external protocols;
- internal application mechanisms.

Origin belongs to metadata and does not require a different primary visual node kind.

## Handler

An architectural component that reacts to a trigger and coordinates one or more transitions.

Possible implementations include:

- Redux Toolkit listeners;
- thunks;
- use cases;
- workers;
- infrastructure callbacks.

Implementation style belongs to metadata.

## State

An architectural state area mutated by the system.

For the initial Redux implementation, state will generally be represented at slice level.

Reducers are implementation details and should normally remain metadata.

State reads and selectors are not primary graph relationships in V1.

## External

A meaningful execution, communication, or persistence boundary.

Examples include:

- backend gateways;
- HTTP APIs;
- persistent storage;
- filesystem;
- SSE / WebSocket;
- native APIs;
- analytics providers.

A function is not External merely because it belongs to another module.

Helpers, mappers, builders and utilities are normally implementation details.

---

# 3. Canonical V1 Relationships

The initial canonical relationships are:

```text
Handler --LISTENS_TO------> Event
Handler --DISPATCHES------> Event
Event   --UPDATES---------> State
Handler --CALLS_EXTERNAL--> External
```

The canonical storage direction and the visual rendering direction are independent concerns.

For example:

```text
Handler --LISTENS_TO--> Event
```

may be rendered visually as:

```text
Event → Handler
```

when that improves comprehension.

The graph must support traversal in both directions.

Two fundamental questions are:

> What can happen from here?

and:

> How can we get here?

---

# 4. Static Truth

FlowAtlas must prefer trustworthy incompleteness over speculative completeness.

Every architectural relationship should be backed by observable source evidence.

Do not infer causality from:

- naming similarities;
- file proximity;
- expected architecture;
- timing assumptions;
- domain intuition;
- likely runtime behaviour.

If a causal link crosses an asynchronous or external boundary and cannot be justified statically, the graph must remain disconnected there.

That gap is useful information.

Future runtime instrumentation may correlate otherwise independent branches, but runtime correlation must remain distinct from static architectural evidence.

---

# 5. Architecture Map, Not Call Graph

Do not promote implementation details into primary graph elements merely because they appear in the call path.

Examples that normally remain outside the primary graph:

- selectors;
- helpers;
- mappers;
- builders;
- formatting functions;
- utilities;
- private orchestration functions;
- incidental cross-module calls.

Ask:

> Does this element explain the architecture, or only how the code is implemented?

If it only explains implementation, keep it as metadata or omit it.

---

# 6. Clean Architecture

FlowAtlas follows Clean Architecture.

Dependencies point inward.

The core architectural model must not depend on technical implementation details.

In particular, the core must not depend directly on:

- Redux Toolkit;
- ts-morph;
- filesystem APIs;
- CLI libraries;
- React;
- visualization libraries;
- Node-specific infrastructure unless the responsibility genuinely belongs there.

Technical tools are details.

The architecture model is the reason the application exists.

---

# 7. Hexagonal Architecture

Use ports and adapters where real architectural boundaries exist.

Examples of likely adapter concerns include:

- TypeScript source analysis;
- symbol resolution;
- filesystem/project loading;
- Redux Toolkit pattern detection;
- CLI input/output;
- visualization;
- future runtime trace ingestion.

Do not create an interface merely to satisfy a diagram.

A port should represent a meaningful capability required by the application/core and implemented by an external detail.

Prefer direct, simple code until a boundary actually exists.

Hexagonal architecture is used to protect responsibilities, not to maximize abstraction count.

---

# 8. Framework Independence

Redux Toolkit is the first architecture FlowAtlas will analyze.

Redux is not FlowAtlas's domain model.

Do not create core concepts such as:

```text
ReduxActionNode
ReduxListenerNode
ReduxSliceNode
```

when the architectural concept is:

```text
Event
Handler
State
```

Redux-specific knowledge belongs in adapters/detectors that translate source constructs into the canonical architecture graph.

The same principle applies to future integrations.

---

# 9. TDD Is the Development Method

FlowAtlas is built test-first.

Tests are not verification added after implementation.

Tests drive the design.

Every behavioural iteration follows:

```text
RED
↓
REVIEW
↓
GREEN
↓
REVIEW
↓
REFACTOR
↓
REVIEW
```

## RED

Choose the smallest useful behaviour.

Write one focused test.

Run it.

Confirm that it fails for the expected reason.

Then STOP.

Do not implement the production code yet.

Present:

- the test;
- the behaviour being specified;
- the failure;
- why the failure is expected;
- any design pressure revealed by the test.

Wait for human validation before moving to GREEN.

## GREEN

After validation, write only the minimum production code required to satisfy the current test.

Run the tests.

Confirm GREEN.

Then STOP.

Explain:

- the implementation;
- why it is minimal;
- any design decision that emerged.

Do not automatically begin another RED iteration.

## REFACTOR

After GREEN, evaluate whether the current design deserves refactoring.

Refactoring is not mandatory.

Avoid speculative cleanup.

When a meaningful refactoring is proposed:

- explain the smell or design pressure;
- explain the intended improvement;
- preserve behaviour;
- keep all tests green.

Significant refactoring should be discussed before being applied.

---

# 10. One Iteration at a Time

Never perform multiple RED → GREEN cycles without returning control to the human collaborator.

Never batch several behaviours into one implementation because they appear obvious.

The desired workflow is deliberate.

The purpose is not merely to obtain test coverage.

The purpose is to let the design emerge from successive behavioural constraints.

---

# 11. Testing Principles

Prefer behavioural tests.

A test should describe what the system knows or does, not how its internals are organized.

Prefer:

- clear test names;
- explicit setup;
- real domain objects;
- named fakes at architectural boundaries;
- small fixtures;
- semantic assertions.

Avoid excessive mocking.

Avoid tests coupled to:

- private functions;
- internal method calls;
- object construction details;
- implementation order;
- incidental framework behaviour.

Do not test an abstraction simply because it exists.

Test meaningful behaviour.

---

# 12. Golden Graph Strategy

The real Fragments Like scenario is the first reference architecture for FlowAtlas.

It contains, among other things:

- optimistic UI;
- Redux events;
- use-case/listener orchestration;
- outbox persistence;
- asynchronous workers;
- external gateways;
- projection synchronization;
- SSE/external protocol events;
- read-model retrieval;
- state reconciliation.

The golden graph must represent only statically observable architectural transitions.

It must also define relationships that must explicitly remain absent.

The golden graph is an acceptance contract, not a hand-written target that the scanner is allowed to fake.

Implementation strategy:

```text
real code
↓
golden graph
↓
identify required source pattern
↓
small behavioural test
↓
implement detector capability
↓
validate fixture
↓
repeat
```

Do not build a generic scanner and then attempt to make Fragments fit it.

Build from real architectural evidence toward reusable capabilities.

---

# 13. Evidence

Architectural edges should eventually be explainable.

The system should be designed so an edge can retain evidence such as:

- source file;
- line;
- symbol;
- AST/source construct;
- detection mechanism.

Examples of evidence categories may eventually include:

- direct registration;
- dispatch;
- reducer;
- external call;
- routed callback.

Do not prematurely finalize this taxonomy.

Let concrete tests drive it.

The important invariant is:

> FlowAtlas should be able to explain why it believes an architectural relationship exists.

---

# 14. TypeScript

Use strict TypeScript.

Prefer precise types.

Avoid:

- `any`;
- unjustified casts;
- broad string types when a meaningful type exists;
- type assertions used to silence design problems.

Types should clarify architectural intent.

Do not create complex type machinery simply to demonstrate TypeScript sophistication.

Readable code wins.

---

# 15. Simplicity

Implement the smallest solution that satisfies the current behaviour and protects known architectural boundaries.

Avoid speculative generalization.

Do not implement infrastructure for:

- every frontend framework;
- arbitrary JavaScript;
- complex monorepos;
- runtime tracing;
- diagnostics;
- plugin marketplaces;
- future visual features;

before there is a tested need.

FlowAtlas may eventually support them.

That is not a reason to implement them now.

---

# 16. Abstractions Must Earn Their Existence

Do not introduce:

- interfaces;
- base classes;
- factories;
- strategies;
- repositories;
- services;
- packages;

without an observed responsibility or dependency boundary.

An abstraction should solve an existing design pressure.

Prefer duplication briefly over the wrong abstraction.

Refactor once the common concept is understood.

---

# 17. Naming

Use names from the architecture and product language.

Prefer:

```text
ArchitectureGraph
Event
Handler
State
External
Edge
Evidence
```

over names tied unnecessarily to implementation technology.

Technical adapter code may naturally use technical vocabulary such as:

```text
ReduxToolkitDetector
TsMorphSymbolResolver
```

when that is its actual responsibility.

The inner model should speak FlowAtlas.

---

# 18. Source Locations

Source navigation is part of the product's value.

Architectural elements should eventually retain enough source information to identify their origin.

At minimum, when supported:

- file;
- line;
- symbol.

Do not let visualization concerns leak into the core representation.

A source location is architectural evidence.

A VS Code URL is presentation/infrastructure.

---

# 19. Visualizer Is a Consumer

The future visualizer consumes `ArchitectureGraph`.

It does not define it.

The core model must remain useful without React, React Flow or any UI framework.

Similarly, the CLI consumes application capabilities.

The CLI must not contain architecture analysis logic.

---

# 20. Refactoring Discipline

After each GREEN iteration, ask:

1. Is the behaviour clear?
2. Is there duplication that now represents a real concept?
3. Is a responsibility in the wrong layer?
4. Has a dependency begun pointing outward from the core?
5. Is framework terminology leaking into the architecture model?
6. Is the code more complicated than the behaviour requires?

If no meaningful improvement is needed, do not refactor for ceremony.

---

# 21. Scope Discipline

For V1, optimize for one outcome:

> A developer can inspect a real event-driven TypeScript application and understand important architectural transitions more easily than by manually navigating its source files.

The initial reference implementation targets Redux Toolkit and the Fragments Like scenario.

Success is not measured by maximum framework coverage.

Success is measured by architectural usefulness and trustworthiness.

---

# 22. Current Product Guardrails

Until explicitly revised, the following rules are authoritative:

1. ArchitectureGraph is the canonical model.
2. Flow is a graph traversal, not a stored linear scenario.
3. Event, Handler, State and External are the primary V1 node kinds.
4. Only statically justifiable relationships belong in the static graph.
5. Asynchronous gaps are valid.
6. Do not infer causal links merely to complete a story.
7. Implementation helpers are not architecture nodes by default.
8. Redux-specific concepts stay outside the core model.
9. Every behaviour is developed through RED → GREEN → REFACTOR.
10. Never advance multiple TDD iterations without human review.
11. Clean Architecture dependency direction must be preserved.
12. Hexagonal boundaries should be explicit where meaningful, not ceremonial.
13. Prefer a small truthful model over a broad approximate one.
14. Build from real code and tests toward abstractions.
15. The map exists to improve human understanding.

---

# 23. Before Modifying the Repository

Before starting any task:

1. Read this `AGENTS.md`.
2. Inspect the relevant current code and tests.
3. Identify the smallest behaviour being requested.
4. Respect the current TDD stage.
5. Do not implement work that belongs to a later stage.
6. Preserve architectural dependency direction.
7. Explain any proposed change to the product vocabulary before introducing it.

When uncertain, prefer stopping with a clear design question rather than silently expanding the model.

---

# 24. Definition of Done for an Iteration

A TDD iteration is complete only when:

- the agreed behaviour is represented by a test;
- the test failed first for the correct reason;
- the minimum implementation makes it pass;
- the full relevant test suite remains green;
- architecture boundaries remain respected;
- the implementation has been reviewed;
- refactoring has either been completed or consciously declined;
- no unrelated behaviour was added.

Then, and only then, begin the next RED.

---

# 25. TDD Interaction Protocol

All development work follows this state machine:

```text
IDLE
  ↓
RED_REQUESTED
  ↓
RED_REVIEW
  ↓
GREEN_REQUESTED
  ↓
GREEN_REVIEW
  ↓
REFACTOR_REVIEW
  ↓
IDLE
```

## RED_REQUESTED

When the human asks for a new RED:

1. Inspect the current code and tests.
2. Identify the smallest requested behaviour.
3. Write exactly one focused failing test.
4. Run the smallest relevant test scope.
5. Confirm that the failure is caused by the missing behaviour.

Then stop.

Report only:

- the test added;
- the behaviour it specifies;
- the failing result;
- why the failure is correct;
- the smallest design pressure revealed.

Do not write production code, refactor, or create the next test.

If the requested behaviour is already satisfied, report that fact honestly.
Do not manufacture a RED by weakening the test or inventing an unrelated API.

## GREEN_REQUESTED

When the human validates a RED and asks for GREEN:

1. Re-read the accepted test.
2. Implement the minimum production code required to satisfy it.
3. Run the focused test.
4. Run the relevant existing suite.
5. Confirm GREEN.

Then stop.

Report:

- production code added or changed;
- test results;
- why the implementation is minimal;
- architectural pressure or smell revealed.

Do not begin the next RED or apply significant refactoring automatically.

## REFACTOR_REVIEW

After GREEN, evaluate whether refactoring is justified:

- Is there real duplication?
- Is responsibility misplaced?
- Is framework terminology leaking inward?
- Is an abstraction now justified by evidence?
- Is the code harder to understand than the behaviour requires?

If no meaningful refactoring is justified, recommend no refactoring.

If a meaningful refactoring exists:

- describe the smell;
- propose the smallest refactoring;
- explain the benefit;
- explain the risk.

Do not apply significant refactoring without human approval.

## REFACTOR_EXECUTION

Only after explicit human approval:

1. Apply the agreed refactoring.
2. Change no behaviour.
3. Run the relevant suite.
4. Confirm that all tests remain GREEN.

Then stop.

## Human Control

The human collaborator owns transitions between TDD states.

The agent must never autonomously perform:

```text
RED → GREEN
GREEN → next RED
REFACTOR proposal → execution
```

without explicit approval.

One TDD state transition equals one interaction checkpoint.

## Behaviour Scope

Each RED describes one meaningful behaviour only. If a request contains
several rules, split them into separate future REDs unless the human explicitly
chooses otherwise.

Do not anticipate documented roadmap concepts. The current accepted test is
the design constraint.

## Default Short Commands

Interpret these short commands as follows:

- `red N`: start the next agreed TDD behaviour in RED mode;
- `green`: implement the minimum code required by the accepted RED;
- `refactor?`: perform `REFACTOR_REVIEW` only;
- an explicit refactoring approval: execute only that refactoring and verify GREEN.

The full protocol does not need to be repeated in each prompt.

## Living TDD Roadmap

Maintain `docs/tdd-roadmap.md` as a record of completed work and possible next
behaviours. The roadmap is informational. It is not permission to implement
future items, and it never replaces explicit human selection of the next RED.

## TDD Cycle Completion

A TDD cycle is not complete when the test becomes GREEN.

The complete cycle is:

```text
RED
↓
RED_REVIEW
↓
GREEN
↓
GREEN_REVIEW
↓
REFACTOR_REVIEW
↓
REFACTOR_EXECUTION, if approved
↓
FINAL_VERIFICATION
↓
COMMIT
↓
PUSH
↓
IDLE
```

The refactoring decision is part of the current TDD cycle. A new RED must
never begin before the previous cycle has been fully completed and pushed.

### REFACTOR_REVIEW

After every accepted GREEN, perform the refactoring review defined in this
document.

If no meaningful refactoring is justified, explicitly recommend no
refactoring, perform final verification, and commit and push the completed
cycle.

If meaningful refactoring is justified, explain the design pressure, propose
the smallest useful change, and wait for human approval. After approval,
execute only that refactoring, verify that behaviour remains unchanged and
tests remain GREEN, then commit and push the complete cycle.

Refactoring is not a separate feature or TDD cycle. The RED, GREEN
implementation and approved refactoring form one development unit.

### FINAL_VERIFICATION

Before committing a completed cycle:

1. Run the full relevant test suite.
2. Run TypeScript type checking.
3. Run configured lint and format checks when applicable.
4. Verify that no unrelated files or behaviours changed.
5. Inspect the Git diff.
6. Confirm that the diff represents only the current cycle.

If verification fails, do not commit or push. Fix only issues belonging to the
current cycle. Report pre-existing or unrelated failures instead of modifying
unrelated code.

### COMMIT AND PUSH

Every completed TDD cycle ends with one Git commit and a push. After final
verification:

1. Inspect `git status` and the final diff.
2. Create one concise Conventional Commit for the completed behaviour.
3. Push the current branch to its configured remote.
4. Verify that the push succeeded.
5. Report the commit hash and message.
6. Confirm that the working tree is clean.

Do not include unrelated changes, force-push, rewrite history or amend a
previous commit unless explicitly requested.

### Cycle Atomicity

One TDD cycle normally produces one commit:

```text
RED test
+
minimum GREEN implementation
+
approved refactoring
=
one completed behaviour
=
one commit
```

Do not commit RED separately from GREEN or approved refactoring.

### Human Checkpoints vs Git Completion

Human approval remains mandatory for:

```text
RED → GREEN
GREEN → REFACTOR decision
proposed significant REFACTOR → execution
```

Human approval is not required for final verification, commit and push once
the behaviour and refactoring decision have been accepted. After a successful
push, return control to the human before starting the next RED.

### Updated Short Command Semantics

- `red N`: start only the RED phase of cycle N;
- `green`: implement the accepted RED and stop for GREEN review;
- `refactor?`: perform the refactoring review;
- explicit refactoring approval: execute it, verify, commit, push, then stop;
- no refactoring recommended: verify, commit, push, then stop.

The human should not need to request `commit` or `push` for a normal completed
TDD cycle. Never automatically begin the next cycle.
