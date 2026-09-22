# Dogs Out feedback delivery plan

Status: **ACTIVE**. Recorded 22 September 2026. The Dogs Out observations are
acceptance drivers, not project-specific scanner rules. Each capability needs a
small independent fixture and replay against real source when available. A
request is versioned only after it executes successfully.

The six milestones below are ordered by dependency. Finish and verify each
milestone before starting the next. Graph assertions cover expected nodes,
expected relations and important absent relations. Static gaps remain gaps.

## 1. Actionable Java semantic failures

**Status: DELIVERED.** Goal: expose the decisive validation or compiler failure
before command and classpath detail. Acceptance: an invalid Java request reports
its request path and specific cause concisely; configuration, missing-type and
compiler failures are distinguishable. The current outer formatter can hide the
cause when a nested process supplies only a long error message. Preserve a
useful remediation without calling every failure stale. Completion requires a
focused RED, a real Java failure replay and the configured verification gates.

The formatter now selects a Java source diagnostic ahead of the child-process
command and classpath and labels the result as a failure rather than assuming
that every request is stale. The focused test covers a compiler diagnostic;
the existing tests retain semantic proof detail. A modified Maven fixture
request reproduced a real missing-handler failure. The full suite passed with
one Vitest worker (195 passed, 3 skipped); default parallel execution caused
resource-related timeouts in unrelated corpus tests.

## 2. Local Java projection without sync notification

**Status: DELIVERED.** Goal: prove a projection mutation independently of a
freshness notification. Acceptance: a local outbox dispatcher and projection
handler behind a port yield only statically justified Event, Handler and State
topology, with no invented sync Event or cross-outbox causality. The request
schema currently binds projection and sync fields together, and the State id
comes from the sync contract. **Decision required:** choose a stable State
identity and source evidence for a projection without that contract. Only then
split the request groups and semantic proof. The alternatives and recommendation
are in the [local Java projection review](architecture/local-java-projection-review.md).

The approved implementation adds `projectionState` for local requests and
checks an exact event-argument mutation before emitting `Event --UPDATES-->
State`. The sync block is optional; when present, its constant projection id
must agree with an explicit state id. A local dispatcher fixture remains absent
from the canonical graph, and the Fragments sync acceptance still passes. The
mutation remains visible when only the sync publication is outside scan scope.
The Dogs Out handler constructs a `CurrentWalkView` from `WalkStarted`, while the
Java request still requires a `DomainEvent` marker and unrelated baseline
fields. Replaying that real path belongs to milestone 3 and must prove the
derived argument without a marker; milestone 2 does not claim that path yet.

## 3. Direct Java hexagonal and outbox paths

**Status: ACTIVE.** Goal: support a typed service, outbox handler and proven
external execution without requiring a command bus, `DomainEvent` marker or
generic publisher. Acceptance: a direct magic-link style fixture yields a
partial, truthful graph; unresolved asynchronous joins stay absent. An
explicit `requestPath` remains required by the current Java adapter. **Decision
required:** identify which existing graph relations can express the observed
path and which evidence belongs outside the primary graph. Port names alone do
not establish an External boundary. The alternatives and recommendation are in
the [direct Java outbox review](architecture/direct-java-outbox-review.md).

First micro-cycle: the legacy typed-handler request block is optional, and a
projection may receive an unmarked event. A mutation argument built directly
from that exact event parameter is proven by resolved symbol identity. The
small fixture and the real Dogs Out `WalkStartedProjectionHandler` both emit
`WalkStarted --UPDATES--> CurrentWalkView` without a sync signal. This does not
yet map the magic-link producer, outbox consumer or SES boundary.
The full repository run could not finish under the current machine load:
unrelated CLI and Java corpus tests hit their execution limits. Focused
Fragments, Dogs Out and fixture replays passed, as did typecheck, lint and
build; the complete suite must be retried before milestone 3 is marked
delivered.

Second micro-cycle: a configured local outbox handler emits `LISTENS_TO` only
when its resolved interface exposes `eventType` and `handle`, the handler
returns one constant route, and a configured dispatcher uses both contract
methods. The fixture and real Dogs Out magic-link consumer pass. The outbox
producer and SES sender remain unconnected and absent from this projection. The
Event id names the constant local route; it does not claim a versioned payload
contract or runtime delivery.

Third micro-cycle: an external client boundary is emitted only when the
configured service calls a resolved port, the configured factory constructs
an adapter implementing that port, and the adapter either invokes the client
directly or invokes a functional field bound to a resolved client method in a
constructor. The small direct-call and bound-reference fixtures pass, as does
the real Dogs Out `DeliverMagicLinkService → SendMagicLinkPort →
AwsSesMagicLinkSender → SesV2Client#sendEmail` path. The outbox producer and
consumer are still separate graph slices; no asynchronous join is inferred.

## 4. Typed Redux thunk dependencies

**Status: PROPOSED.** Goal: resolve method calls on typed `extra` dependencies
in `createAsyncThunk` payload creators. Acceptance: the StartWalk and onboarding
thunks expose proven external boundaries, while unrelated or unresolved calls
stay absent. Existing handwritten thunk gateway resolution is a starting point;
do not classify every injected interface as External.

## 5. Dispatches outside Redux thunks

**Status: PROPOSED.** Goal: recognize a resolved event/observer factory whose
callbacks dispatch slice actions through an application coordinator.
Acceptance: an authentication coordinator links to proven dispatched Events and
their State mutations without recording secrets or inventing calls through
dynamic callbacks. An independent fixture must establish the reusable rule.

## 6. State composition and context trust

**Status: PROPOSED.** Goal: explain the `dogSlice` store composition and state
consumption, and clarify what `complete` means for a bounded context. The
current context completeness describes graph traversal within its limits; it
does not prove application coverage. Acceptance: the response makes that scope
clear, and any added state topology has explicit static evidence. **Decision
required:** reducer composition, preloaded state and selector reads do not map
directly to the four canonical relation kinds; decide whether they belong in
the primary graph or explanatory evidence before changing the model.

## Shared constraints and open questions

- Keep the four NodeKinds and four RelationKinds unless repeated evidence and
  human review justify a vocabulary change.
- Keep resolution context broader than scan scope without emitting out-of-scope
  architecture.
- Validate each new scanner capability on a small fixture and a real corpus.
- Do not connect outbox writing to later dispatch by name, timing or expected
  runtime behavior.
- Record newly discovered micro-cycles from acceptance failures, not in advance.
