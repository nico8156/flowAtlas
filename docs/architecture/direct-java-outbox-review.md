# Review: direct Java use cases and local outbox

Status: **OPTION A APPROVED; MILESTONE ACTIVE**. This review guides milestone 3
in the [Dogs Out feedback plan](../dogs-out-feedback-delivery-plan.md).

## Problem

The Java adapter requires a Fragments-shaped baseline request: a `DomainEvent`
marker, generic event handler, provider and explicit `requestPath`. Dogs Out's
magic-link path has no marker, command bus or generic domain-event publisher.
It still contains statically identifiable architecture, but its source path
cannot be submitted honestly through the current request schema.

## Evidence

- `RequestMagicLinkService#request` constructs
  `MagicLinkDeliveryRequested` inside `MagicLinkRequestPersistence` and passes
  it to `SaveRequestedMagicLinkPort`. The event is a Java record with no marker
  interface.
- `PostgresMagicLinkRequestAdapter` and
  `MagicLinkDeliveryRequestedOutboxHandler` use a constant event type. The
  latter validates and deserializes the local outbox message, then invokes
  `DeliverMagicLinkUseCase`.
- `DeliverMagicLinkService` invokes `SendMagicLinkPort`; the configured
  `AwsSesMagicLinkSender` implements that port and calls SES. The port alone
  does not prove external execution.
- `WalkStartedProjectionHandler` receives an unmarked event and constructs a
  `CurrentWalkView` from its fields before calling `SaveCurrentWalkViewPort`.
  Milestone 2 proves only a direct event-argument mutation.
- The Java semantic helper currently resolves `domainEvent`, `eventHandler`,
  `handler`, `provider`, `providerMethod` and a nonempty `events` list before
  analyzing optional slices. Java MCP discovery and context require an explicit
  `requestPath`.

## Current model

The canonical graph allows `Handler --DISPATCHES--> Event`,
`Handler --LISTENS_TO--> Event`, `Event --UPDATES--> State` and
`Handler --CALLS_EXTERNAL--> External`. It has no Handler-to-Handler or
Port-to-Handler relation. Ports, repositories and adapters are proof material
unless an external execution boundary is statically established. An outbox
write and later dispatch do not imply continuous runtime causality.

## Pressure

The requested phrase `port → handler → message` cannot be represented literally
with the four relation kinds. A direct method call from the outbox consumer to
the delivery use case proves delegation in source, but the graph has no
relation for it. Treating the whole path as one Handler would erase source
responsibilities and conditional routing; joining the outbox write to the
consumer by matching names would invent causality.

## Option A: partial graph with explicit gaps

Make Java request blocks independently selectable, so a typed direct use case,
configured local outbox contract, projection and resolved external adapter can
be analyzed without Fragments abstractions. Keep `requestPath` explicit for
reproducibility, while improving the validation message and documenting a
minimal request. Emit only individually proven canonical relations. Preserve
separate Handler identities and any missing relation between them. Expose
resolved ports, delegation and contract checks as diagnostics or explanation
only where source proof exists, without introducing a new facts model.

Benefit: broadens Java coverage without changing the graph language. Cost:
some useful source connections remain visible only through locations and
diagnostics, and users may need a second bounded source read. Product impact:
`complete` continues to mean graph traversal completeness, not that every
application step is connected. Over-engineering risk: low if each request
block is driven by one acceptance slice and evidence stays bounded.

## Option B: add explicit delegation topology

Introduce a reviewed Handler-to-Handler relation for statically proven direct
delegation, and consider a port node/relation only after repeated cases show
that the port is itself an architectural boundary worth rendering. Still keep
the asynchronous outbox gap unless a concrete contract proof is defined.

Benefit: the source call from the outbox consumer to the delivery use case
would appear in one graph traversal. Cost: changes the canonical graph and
public vocabulary, expands detector responsibilities toward a call graph and
requires negative evidence for ordinary helper calls. Product impact: every
adapter and visualizer must understand a new relation. Over-engineering risk:
high on the current evidence; a single use case does not establish a stable
architectural rule.

## Recommendation

Choose **Option A**. Start with a small direct-use-case fixture and replay the
Dogs Out magic-link and WalkStarted slices separately. Verify expected nodes
and edges plus absent joins. The real outbox contract may justify more later,
but no port node, delegation edge or inferred asynchronous continuity should
be added in this milestone. Keep `requestPath` explicit until a separate
usability acceptance demonstrates that inline or inferred Java requests can
be validated without hiding scan scope or proof configuration.
