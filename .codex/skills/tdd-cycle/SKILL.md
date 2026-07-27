# TDD Cycle Skill

Use this workflow for one local behaviour. Tests must precede production
implementation. One cycle normally produces one commit.

## Cycle

```text
RED -> RED Inspector -> GREEN -> Refactor Inspector -> verification -> commit -> push -> STOP
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
