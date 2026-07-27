# Architecture Review Skill

Use this workflow when an inspector returns `ESCALATE` or a request may alter
the product model or dependency architecture. Do not modify code before the
decision.

## Format

### Problem

State the concrete gap or pressure.

### Evidence

Show relevant tests, source constructs, graph output and responsibilities.
Separate facts from inference.

### Current model

Describe the current vocabulary, invariant or pipeline.

### Pressure

Identify the exact conflict, not a generic future concern.

### Option A

Describe principle, benefit, cost, product/architecture impact and
over-engineering risk.

### Option B

Describe the same points. Present no more than two primary options unless the
evidence requires another.

### Recommendation

Recommend one option or state that more evidence is required.

Then STOP for human decision. Do not create a workaround RED to avoid the
architectural question.
