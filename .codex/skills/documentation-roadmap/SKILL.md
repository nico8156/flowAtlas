# Documentation And Roadmap Skill

Keep documentation truthful, concise and aligned with code, tests and Git
history. Future work is not permission to implement it.

## Roadmap structure

The roadmap is milestone-driven, not a long list of predetermined REDs. Each
milestone records:

- Goal;
- acceptance driver;
- status: `DELIVERED`, `ACTIVE`, `PROPOSED` or `LONG TERM`;
- known gaps;
- decisions;
- discovered micro-cycles;
- open design questions;
- completion criteria.

Use this rule:

> The roadmap defines the destination. The acceptance defines the path. Micro
> REDs build the path.

Keep historical cycle numbers and explain their outcome. Maintain only a small
set of probable next behaviours after inspecting the current acceptance.

Before editing, compare documentation against the repository. Move procedural
instructions to skills instead of duplicating them in `AGENTS.md`. Verify
commands and status claims, inspect the diff, run documentation checks, commit
and push the documentation cycle. Do not start the next milestone.
