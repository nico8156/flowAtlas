# FlowAtlas Engineering Constitution

This file contains repository invariants. Procedural workflows live in the
specialized skills under `.codex/skills/`.

## Product model

FlowAtlas is an architecture map, not a call graph.

`ArchitectureGraph` is the canonical model. It represents a graph, not a
stored linear flow. A flow is a traversal, projection or view over the graph.
The graph does not assume a root, an end, synchronous execution, continuous
causality or one scenario.

Static truth is more important than speculative completeness. Asynchronous and
distributed gaps are valid architecture. Never invent causality from names,
file proximity, timing, domain intuition or expected runtime behaviour.

## V1 vocabulary

Primary node kinds:

- `Event`
- `Handler`
- `State`
- `External`

Canonical relation kinds and storage directions:

```text
Handler --LISTENS_TO------> Event
Handler --DISPATCHES------> Event
Event   --UPDATES---------> State
Handler --CALLS_EXTERNAL--> External
```

The graph is traversable in both directions. Visual rendering may use a
different direction when it improves understanding.

An Event is not necessarily a Redux action. A Handler is not necessarily a
Redux listener. State is an architectural state area, normally represented at
slice level for the initial Redux adapter. External is a meaningful execution,
communication or persistence boundary, not an arbitrary cross-module call.

Helpers, selectors, mappers, builders, utilities and incidental orchestration
remain implementation details unless they explain an architectural boundary.

Do not add a NodeKind or RelationKind to solve one syntax pattern or one
fixture. A new vocabulary concept requires real repeated evidence and human
review.

## Architectural boundaries

FlowAtlas follows Clean Architecture and Hexagonal Architecture.

Dependencies point toward the core. The domain model must not depend on
Redux, the TypeScript Compiler API, ts-morph, filesystem APIs, CLI libraries,
React or visualization libraries.

Redux Toolkit is an adapter/detector concern, not the FlowAtlas domain model.
Technical details must not be promoted into domain concepts merely because
they appear in source code.

Use ports and adapters where a real dependency boundary exists. Do not create
interfaces, packages or layers ceremonially.

## Static analysis trust

Architectural relationships must be statically justifiable. Unresolved or
dynamic relationships are omitted or diagnosed; they never become dangling
edges. `ArchitectureGraph` remains strict and the scanner is tolerant.

External relationships may cross bounded internal orchestration when the
external boundary remains statically identifiable. This must not turn the
scanner into a general call graph.

Project TypeScript context may be broader than the architectural scan scope.
Detectors must respect the requested scan scope while resolvers may use the
complete project context.

Evidence and analysis facts may explain a graph result, but the primary graph
must remain small and architectural.

## Development rules

TDD is the method of construction: tests precede production behaviour and
acceptance tests drive milestones. Every new scanner capability needs a small
fixture and validation against real code when available.

Human reviews decisions, not ceremony. Local, mechanical behaviour may follow
the autonomous TDD workflow in `.codex/skills/tdd-cycle/SKILL.md`.

Human escalation is mandatory for:

- a new NodeKind or RelationKind;
- a change to a domain invariant or canonical graph model;
- a new structural Clean/Hexagonal boundary or port;
- an intermediate representation or facts model;
- a heuristic, speculative inference or runtime correlation;
- a dependency-direction change;
- an ambiguous specification or multiple valid architectural models;
- a behaviour that changes the meaning of Event, Handler, State or External;
- a significant public API change.

Do not widen scope autonomously. If the current model is under pressure,
read the relevant skill and escalate the decision rather than silently
generalizing.

## Acceptance-driven milestones

Milestones start from a real acceptance driver whenever possible. The
acceptance test is a projection of `ArchitectureGraph`: it checks expected
nodes, expected edges and important absent edges. It is not required to equal
the complete graph produced for the corpus.

When an acceptance fails, challenge the specification before changing the
scanner. A statically justified extra relation should normally update the
projection rather than be removed from production.

Acceptance gaps must be classified before implementation. A local resolver or
detector gap may proceed automatically; a product or architecture ambiguity
must stop for human review.

## Repository discipline

Before modifying the repository:

1. Read this file and the specialized skill for the requested workflow.
2. Inspect the current code, tests and relevant documentation.
3. Identify the smallest behaviour or decision involved.
4. Preserve the invariants above and existing user changes.

A completed cycle includes the RED test, minimum GREEN implementation,
appropriate local refactoring, final verification and one Conventional Commit
that is pushed to the configured remote. The working tree should be clean.

Do not force-push, rewrite history, amend previous commits or include
unrelated changes. Never start the next milestone automatically after one is
complete.

## Skills

Read the specialized skill corresponding to the work before executing it:

- `.codex/skills/tdd-cycle/SKILL.md`
- `.codex/skills/acceptance-slice/SKILL.md`
- `.codex/skills/scanner-development/SKILL.md`
- `.codex/skills/architecture-review/SKILL.md`
- `.codex/skills/documentation-roadmap/SKILL.md`
- `.codex/skills/architecture-exploration/SKILL.md`

When a skill and this constitution conflict, this constitution wins.
