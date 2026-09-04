---
name: architecture-exploration
description: Use FlowAtlas to orient code exploration when a task concerns an event-driven use case, crosses architectural elements, or has an unclear architectural entry point. Do not use it for an obviously local implementation detail.
---

# Architecture Exploration

Use FlowAtlas as an orientation map before reading implementation details.
FlowAtlas establishes statically observable architecture; it does not replace
source inspection or prove runtime causality.

## Exploration

Prefer the configured MCP tools `flowatlas_find_nodes` and
`flowatlas_get_context` when they are available. Use the source-checkout CLI
commands below only as a fallback when those tools are unavailable or fail.
Do not query the same territory through both transports merely to confirm a
successful result.

If the task already names a likely `Event`, `Handler`, `State` or `External`
node id, call `flowatlas_get_context` directly. Do not first search for that id
with `rg`, enumerate project files or call `flowatlas_find_nodes`. Otherwise,
call `flowatlas_find_nodes` for a small candidate set first.

For a source-checkout CLI fallback, use:

```text
node dist/index.js find <query> [path] --kind <kind> --limit 5 --json
```

Choose a candidate from its id, kind and source location. Do not infer a match
from directory proximity alone. Then request a bounded context:

```text
node dist/index.js context <nodeId> [path] --direction both --depth 3 \
  --max-nodes 40 --max-edges 80 --max-bytes 16384 --json
```

These commands are for the FlowAtlas source checkout. A consuming repository
with FlowAtlas installed as a development dependency may use its local package
binary instead.

Read the source files referenced by the returned nodes before editing. Use the
canonical node ids and relations from the projection when describing the
architecture.

Begin with one projection. Do not expand a complete projection merely to make
the architectural account more exhaustive. Open only the referenced sources
needed to decide or perform the requested change; source inspection may reveal
implementation details that are intentionally absent from the graph.
Do not run a broad symbol search merely to reconfirm nodes and relations that a
successful projection and its referenced source already establish.

If `complete` is false and a returned frontier can affect the task, deepen the
exploration from the relevant frontier node rather than exporting the complete
graph. If `frontierComplete` is false, treat `omittedFrontierCount` as an
explicit warning that additional boundary relations were removed to respect
the byte budget. An absent relation is not equivalent to a frontier relation
omitted by the requested budget.

If the projection is complete but the task explicitly requires territory past
its depth boundary, issue one new bounded `context` request from the nearest
relevant boundary node. Do not explore unrelated high-connectivity nodes.

Preserve static gaps. Never invent causality between disconnected branches,
across an external boundary, or from names and expected runtime behavior.

## Stop condition

Stop expanding when the returned territory identifies the source files and
architectural relations relevant to the task. Continue with normal source
inspection, implementation and verification; do not treat the projection as
an exhaustive list of files to modify.
