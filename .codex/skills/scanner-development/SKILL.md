# TypeScript Scanner Development Skill

The scanner is an adapter translating statically observable TypeScript
constructs into the framework-independent architecture graph.

## Context and scope

Project TypeScript context and architectural scan scope are different. Project
context supports symbol and type resolution; scan scope determines which
constructs become architectural output. Resolvers may use complete context;
detectors must respect the requested scope.

Build shared indexes once per scan when repeated lookups are demonstrated.
Avoid repeated global AST scans and preserve declaration identity when names
collide.

## Architectural granularity

Detect Events, Handlers, State and External boundaries. Helpers and internal
functions may be traversed to discover a boundary but must not become graph
nodes by default. This is bounded architectural propagation, not a general
call graph.

External is meaningful only when source evidence identifies an execution,
communication or persistence boundary. Do not infer it from module location or
names alone.

## Resolution rules

- Treat function declarations, arrow functions and function expressions
  uniformly.
- Prefer shared symbol/function/type resolvers and indexes.
- Keep unresolved references out of the graph; never weaken domain endpoint
  invariants to accept dangling edges.
- Keep analysis facts/evidence distinct from primary graph nodes and edges.
- Avoid heuristics and speculative asynchronous correlation.

Do not introduce an intermediate facts model merely because propagation is
non-trivial. Escalate only when several detectors reconstruct the same
temporary information, propagation is materially duplicated, evidence needs
discarded facts, or real acceptance gaps repeatedly show the same loss between
analysis stages.

Every scanner capability requires a minimal fixture and, when possible,
validation against a real-code acceptance slice.
