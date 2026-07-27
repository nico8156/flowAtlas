# Acceptance Slice Skill

Use this workflow for a milestone driven by real application code.

```text
milestone -> acceptance RED -> Gap Inspector -> micro-cycle -> replay -> next gap -> acceptance GREEN
```

## Acceptance driver

Start from a real corpus and define the smallest useful architectural
projection. Check expected nodes, expected edges and important absent edges
that prevent invented causality.

An acceptance is a projection of `ArchitectureGraph`, not an exhaustive graph
equality. Additional statically justifiable topology is valid. An acceptance
may remain RED while local micro-cycles close its gaps.

## Gap Inspector

For every failed replay, record expected result, actual result, missing or extra
nodes/edges, real source evidence, precise cause and gap category.

Categories include detector capability, resolver capability, unresolved
symbol/type, source context/scope, performance/indexing, obsolete acceptance
specification, product/architecture ambiguity and statically impossible
relationship.

Classify each gap:

- `AUTO`: a local TDD cycle can resolve it without a new decision.
- `ESCALATE`: stop because it changes product vocabulary, graph meaning,
  invariants, evidence semantics or has multiple valid models.

Challenge the acceptance specification before changing production when the
scanner found a statically justified relationship the projection did not
anticipate.

After each AUTO micro-cycle, commit and push before replaying the acceptance.
Stop when the acceptance is GREEN or any inspector returns `ESCALATE`. Never
start the next milestone automatically.
