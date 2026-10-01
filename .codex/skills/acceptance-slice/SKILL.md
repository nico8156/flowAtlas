---
name: acceptance-slice
description: Drive a FlowAtlas milestone from real-corpus acceptance gaps through autonomous local TDD cycles and targeted mutation validation, stopping at model ambiguity or milestone completion.
---

# Acceptance Slice Skill

Use this workflow for a milestone driven by real application code.

Read [the iteration workflow](../tdd-cycle/references/iteration-workflow.md).
Classify each increment independently of its architecture route. Keep probable
examples provisional and let each cycle revise the design.

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

Before closing a meaningful green micro-cycle, challenge its decisions through
targeted mutations and PIN any missing protection for agreed behavior. A larger
acceptance may still be RED: use an independently green local mutation baseline,
and do not count unrelated acceptance failures as kills. Preserve explicit
expected-absent-edge assertions when assessing static-analysis faults.

After each AUTO micro-cycle, restore mutations, verify, commit and push before replaying the acceptance.
Stop when the acceptance is GREEN or any inspector returns `ESCALATE`. Never
start the next milestone automatically.
