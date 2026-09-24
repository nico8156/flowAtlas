# Review: Redux state composition and bounded context trust

Status: **OPTION A DELIVERED**.

## Problem

Dogs Out composes `dogReducer`, `authenticationReducer` and `onboardingReducer`
with `combineReducers`, seeds `dog` through `preloadedState`, and reads the
selected dog through selectors. A bounded FlowAtlas context currently finds the
canonical `dogSlice` State but may return no neighboring relations. The graph
vocabulary has no relation for reducer composition, state initialization or
selector reads.

## Evidence

- `createAppStore` passes the reducers to `combineReducers` and provides a
  `dog` entry in `preloadedState`.
- `WalkScreen` and onboarding screens consume state through selectors.
- The scanner now proves `createSlice` action Events and their `UPDATES`
  relations, so state mutations remain architectural graph topology.
- A bounded context response describes traversal inside the requested limits;
  it does not establish whole-application coverage.

## Current model

The canonical graph contains only `Event`, `Handler`, `State` and `External`,
with `LISTENS_TO`, `DISPATCHES`, `UPDATES` and `CALLS_EXTERNAL`. Reducer
composition, initialization and reads are not one of these relations.

## Pressure

Adding a relation for every reducer or selector would change the graph from an
architecture map toward a runtime data-flow or dependency graph. Omitting all
evidence leaves users unable to distinguish an isolated State node from a
bounded traversal that simply stopped at the requested frontier.

## Option A: keep the primary graph strict and enrich context evidence

Keep reducer composition, `preloadedState` and selector reads out of the
canonical graph. Return explicit bounded-context metadata describing the scan
frontier, omitted source scope and whether the State was discovered through a
slice, reducer registry or selector. This preserves the graph vocabulary and
avoids inventing causality. The cost is that those relationships remain
explanatory rather than traversable.

## Option B: add state composition and read relations

Introduce reviewed relation kinds for reducer composition, initialization and
selector consumption. This would make the store boundary visible in one graph,
but requires new domain invariants, rendering and traversal semantics. It also
risks promoting ordinary reads and wiring details into architecture nodes.

## Decision and implementation

Choose **Option A**. The new Dogs Out evidence establishes a product-facing
trust problem in the meaning of `complete`, but it does not justify new graph
relations. Implement a bounded-context explanation and a reducer composition
diagnostic only after human approval of its public shape. Do not infer a
`dogSlice` runtime dependency from `preloadedState` or selector names alone.
Architecture context responses now expose `coverage.graph =
bounded-projection` and `coverage.application = not-assessed`. The primary
graph remains unchanged, and the Dogs Out bounded-context acceptance verifies
the new contract.
