# Review: local Java projection state identity

Status: **OPTION A APPROVED AND IMPLEMENTED FOR DIRECT MUTATIONS**. This review
records the decision for milestone 2 in the
[Dogs Out feedback plan](../dogs-out-feedback-delivery-plan.md).

## Problem

A Java projection can update a local view without emitting a projection-sync
notification. The current Java request and detector require both mechanisms.

## Evidence

- Dogs Out reports `WalkStartedProjectionHandler` calling
  `SaveCurrentWalkViewPort`, with persistence in `PostgresCurrentWalkViewAdapter`
  and no sync publisher. This is user-provided source observation, not a graph
  proof yet.
- `javaMavenSemanticContext.mjs` requires all projection and sync request
  properties together.
- `JavaSemanticSpike.java` requires exactly one direct repository mutation and
  sync publication, then takes the projection name from the sync factory call.
- `javaProjectionDetector.ts` requires the sync source to be in scan scope and
  emits `State("tickets")` and `Event("sync:tickets:entity")` for the existing
  Fragments acceptance. The repository stays out of the canonical graph.

## Current model

`State` names an architectural state area. A proven mutation supports
`Event --UPDATES--> State`; an independently proven sync publication supports
`Handler --DISPATCHES--> Event`. Ports and repositories are evidence, not
automatically nodes. The graph has no relation for a handler directly updating
a state area. The current `tickets` State id comes from a constant in the sync
contract, not from a database table or Java repository type.

## Pressure

Without sync, there is no current source for a stable architectural State id.
Using a repository, table or view class name as if it were the state area would
change what `State` means. Accepting an arbitrary request label without a
verified mutation would turn configuration into invented topology.

## Option A: explicit projection identity in the request

Add a required architectural projection id to the local-projection request
block. Emit its `State` only after semantic analysis proves the configured
handler receives the configured event and invokes the configured mutation. If
the optional sync block exists, require its constant projection value to match
the explicit id. Preserve existing Fragments requests by deriving their id
from the sync contract when no explicit id is supplied.

Benefit: one stable state-area identity independent of persistence technology;
existing Fragments ids remain intact. Cost: the user supplies an architectural
label, and FlowAtlas must validate it against the proven mutation and optional
sync contract. Product impact: the request becomes a declaration of State
identity, while source analysis remains the gate for graph edges. Over-engineering
risk: adding broader identity configuration before a second corpus proves the
need. Scope it to this projection block.

## Option B: derive local identity from the repository port type

Use the resolved fully qualified repository port type as the local State id,
while retaining the sync-derived id for existing requests.

Benefit: no new identity field; every id comes from a resolved source symbol.
Cost: the same architectural state could acquire different ids when a sync
contract is added; the repository port names storage access rather than
necessarily the state area. Product impact: this weakens the architectural
meaning of `State`. Over-engineering risk: later aliasing or reconciliation
logic to repair duplicate identities.

## Recommendation

Choose **Option A**, subject to validation against the actual Dogs Out source.
The request label is acceptable only when the exact event-fed mutation is
proven. The acceptance must assert the local State and `UPDATES` relation,
absence of sync Event and absence of any inferred join across the outbox.
If Dogs Out lacks a statically identifiable event-fed mutation, keep the gap
visible and revisit the acceptance rather than weakening the proof.
