---
name: tdd-cycle
description: Develop one FlowAtlas behavior through emergent TDD, or pin and refactor existing behavior with targeted mutation evidence. Use acceptance-slice for multi-cycle corpus milestones.
---

# TDD Cycle Skill

Use this workflow for one local behaviour. Read
[the iteration workflow](references/iteration-workflow.md) and classify the
iteration before implementation. Tests must precede new production behaviour.
One cycle normally produces one commit.

Expose the observable outcome, acceptance boundary, first concrete example,
likely next examples and uncertainties. Revise this trajectory from feedback;
do not prescribe the final detector, resolver, graph representation or algorithm.

## Cycle

```text
RED -> RED Inspector -> minimum GREEN -> GREEN Inspector -> Refactor Inspector -> targeted mutation/PIN -> verification -> commit -> push -> STOP
```

## RED Inspector

1. Inspect current code and tests.
2. Choose the smallest behaviour and write exactly one focused behavioural test.
3. Run the smallest relevant scope.
4. Confirm the failure is caused by the missing behaviour.

Check that the test is behavioural, necessary, within the current milestone,
not already satisfied, and does not hide a product or architecture decision.

Verdicts:

- `PASS`: continue automatically to GREEN.
- `REVIEW`: continue, but report the implication.
- `ESCALATE`: stop for human decision.

Never manufacture a RED for behaviour that already passes.

## GREEN

Implement only what the accepted RED requires. Run the focused test and the
relevant existing suite. Do not add future behaviour.

## GREEN Inspector

Confirm the example passes for the intended reason and that each new branch or
abstraction is justified by an example or existing invariant. Anticipating a
future capability does not authorize implementing it. Revise the next example
when the design reveals a different question.

## Targeted mutation and PIN

Apply the reference checkpoint on a green local scope before completing a
meaningful behavior cycle. Prefer fast fixtures and graph/application tests.
Analyze survivors for missing protection, equivalence or contract ambiguity.
For missing protection, add one PIN that passes on the original and fails on
the mutant; continue autonomously when the expected behavior is already agreed.

Record commands, mutations, outcomes and dispositions. Compiler/setup failures
are not behavioral kills. Restore all mutations and verify the final suite.
Do not invent edges or change graph semantics to improve a mutation score.
REFACTORING starts green and uses PIN if protection is missing. CHORE needs
proportionate checks, not a fabricated RED.

## Refactor Inspector

Local mechanical refactoring may run automatically when behaviour, architecture
and public APIs are unchanged. Examples: extracting a function, removing
duplication, renaming an internal symbol or reusing an existing resolver.

Escalate architectural refactoring such as a new ScanContext, a structural
port, an IR/facts model, a central pipeline change or a responsibility move
between layers.

## Verification and completion

Run the relevant full test suite, typecheck, lint, format and build when
configured. Inspect the diff and exclude unrelated changes.

Create one Conventional Commit for the complete cycle and push it. Report the
commit, push result and working-tree status. Never begin the next cycle.
