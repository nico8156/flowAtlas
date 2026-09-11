# Java Semantic Feasibility

Date: 11 September 2026.

For the visual objective, lot status and delivery history, see
[`java-scanner-delivery-map.md`](java-scanner-delivery-map.md).

## Purpose

FlowAtlas reconstructs statically observable event-driven architecture. Redux
Toolkit is its first analysis adapter, not its domain model. This decision
records the boundary for investigating Java support against the pinned
`fragmentsClean` backend commit `c5319de`.

The investigation must determine whether Java semantic tooling can supply the
language facts required by focused FlowAtlas detectors. It does not authorize a
generic Java analyzer, a call graph, or support for every Spring messaging
technology.

## Approved graph decision

Java support keeps the V1 graph vocabulary unchanged:

```text
Handler --LISTENS_TO------> Event
Handler --DISPATCHES------> Event
Event   --UPDATES---------> State
Handler --CALLS_EXTERNAL--> External
```

The four existing `NodeKind` values and four existing `RelationKind` values are
retained. No intermediate facts model is introduced for the initial work.

At the FlowAtlas level, `Event` means an architectural message or signal:
something was requested or happened. Java commands, domain events, public
integration events and protocol signals may therefore be represented as
different Event identities without claiming that they have the same DDD role.

The intended identities are initially:

```text
java-command:<fully-qualified-class-name>
java-domain-event:<fully-qualified-class-name>
integration:<destination>:<event-type>:v<version>
protocol:http:<method>:<path>
sync:<projection>:<scope>
```

An internal domain event and its public integration contract remain distinct.
An integration event is identified by destination, stable event type and
version; event type alone is insufficient because one producer event may be
mapped differently for different destinations.

## Architecture boundary

The target dependency direction is:

```text
Java semantic context
-> Java infrastructure detectors
-> ArchitectureGraph
```

The semantic engine owns Java facts such as declarations, type identity,
imports, inheritance, annotations, overload resolution and generics. FlowAtlas
detectors decide whether those facts justify an Event, Handler, State, External
or relation. No Java, Spring, Maven, SQS or JPA type enters the domain graph.

Project context and architectural scan scope remain separate. A resolver may
use the complete Maven/classpath context while detectors emit architecture only
for the requested source scope.

## Initial corpus evidence

The pinned Fragments backend supplies several independent evidence mechanisms:

- `CommandHandler<C>` and `CommandHandlerWithResult<C, R>` bind commands to
  handlers through generic type identity;
- `DomainEvent` marks internal business events;
- `EventHandler<E>` binds local handlers to domain events;
- `AggregateRoot.registerEvent(E)` and `DomainEventPublisher.publish(E)` expose
  publication sites;
- the transactional outbox stores the producer event class and metadata;
- `IntegrationEventTypeCatalog` and `IntegrationEventDestinationResolver` map
  producer events to public destination-specific identities;
- `SqsIntegrationEventRoute(destination, eventType)` binds consumers, including
  handlers created by Spring `@Bean` methods, lambdas and private records;
- projection handlers mutate local repositories and subsequently publish
  `ProjectionSyncEvent` records;
- hexagonal ports may lead to HTTP, SQS, SSE, PostgreSQL, S3, SES or a local
  process when the resolved adapter proves that boundary.

Names and package proximity are not evidence. A `*Event`, `*Handler`,
`*Repository` or `*Gateway` suffix may identify a candidate but cannot create a
graph node or edge by itself.

## First acceptance driver

The first real-code acceptance starts inside the event flow, before HTTP and
command support:

```text
TicketVerifyAcceptedEvent
-> TicketVerificationProcessManager
-> TicketVerificationProvider
-> TicketVerificationCompletedEvent
```

It should eventually establish the following statically justified projection:

- both concrete domain event types are Events;
- `TicketVerificationProcessManager` is a Handler that listens to the accepted
  event;
- its provider invocation crosses an External boundary only when adapter
  resolution proves one;
- it dispatches the completed event only when bounded propagation through the
  exact aggregate transition proves that publication;
- homonymous, unresolved or merely conventionally named declarations create no
  relation.

The acceptance is a projection, not complete graph equality. The outbox, SQS,
projection and HTTP portions are later delivery territory and must not be added
to make the first acceptance appear complete.

## Delivery lots

| Lot | Status    | Destination                                                                                                       |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 00  | DELIVERED | Record the graph vocabulary, Event roles, identities and investigation boundary.                                  |
| 01  | DELIVERED | Compare Java semantic engines on one fixture and the pinned acceptance source, then select one with evidence.     |
| 02  | DELIVERED | Load a Java project with full resolution context and bounded architectural scan scope.                            |
| 03  | DELIVERED | Detect domain events, typed local handlers and statically proven publication.                                     |
| 04  | DELIVERED | Add the shared scanner port, HTTP protocol signals, commands and typed command handlers.                          |
| 05  | PROPOSED  | Reconstruct outbox mapping, public integration identities, destinations, SQS routes and inbox-backed consumers.   |
| 06  | PROPOSED  | Detect event-fed projection State and Projection Sync signals.                                                    |
| 07  | PROPOSED  | Detect resolved external execution, communication and persistence boundaries.                                     |
| 08  | PROPOSED  | Validate bounded Fragments projections and expose Java through the existing CLI and MCP application capabilities. |
| 09  | LONG TERM | Generalize only from additional real corpora and repeated evidence.                                               |

Each proposed lot requires its own acceptance or focused behavioral RED and is
not authorized by this document. Work stops after completing each lot.

## Lot 01 engine decision

The JDK compiler API is selected for the first Java semantic adapter. The
selection is intentionally narrower than a permanent commitment to one parser:
it is the smallest engine that answered every query required by the first
Fragments slice without adding a production dependency.

| Candidate                  | Relevant capability                                                                                                               | Cost or limitation observed for FlowAtlas                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| JDK compiler API           | `JavacTask`, `Trees`, `Elements` and `Types` expose compiler-resolved declarations, generics, assignability and source positions. | Requires a JDK and an explicit project classpath. Its types remain confined to the Java adapter.                                           |
| JavaParser + Symbol Solver | Resolves AST names and method calls to declarations through configured type solvers.                                              | Adds a parser/runtime dependency and separate Java-version and classpath configuration without reducing the first adapter surface.         |
| Spoon                      | Builds a high-level source model; `MavenLauncher` derives sources and dependencies from a Maven project.                          | Builds a broader mutable model than the first read-only queries need and may maintain Maven classpath cache files in the analyzed project. |
| Eclipse JDT                | `ASTParser` can resolve names and types when binding resolution and its environment are configured.                               | Adds a compiler dependency and lower-level classpath/sourcepath setup; binding resolution also has an explicit time and memory cost.       |

The controlled fixture proves all four required queries:

- concrete assignability to `DomainEvent`, including rejection of a
  convention-only `ConventionOnlyEvent`;
- recovery of the concrete argument from `EventHandler<E>`;
- resolution of `TicketVerificationProvider.verify(String, String)` to its
  declaring interface rather than its spelling;
- fully qualified identities and source locations.

The same probe passes against the Fragments ticket-verification slice with a
Maven-derived Java 21 classpath and no compiler diagnostics. It resolves:

```text
TicketVerifyAcceptedEvent implements DomainEvent
TicketVerificationCompletedEvent implements DomainEvent
TicketVerificationProcessManager implements EventHandler<TicketVerifyAcceptedEvent>
TicketVerificationProcessManager#handle(...) -> TicketVerificationProvider#verify(...)
```

The acceptance baseline remains commit `c5319de`; the same source identities
and direct publication were revalidated through Lot 04 on descendant commit
`cc82485` without changing this slice.

This last arrow is a Java symbol-resolution fact only. It does not yet emit
`CALLS_EXTERNAL`: proving that the injected port reaches a meaningful external
adapter belongs to the later external-boundary lot.

The isolated probe lives in `scripts/JavaSemanticSpike.java`. It deliberately
returns semantic evidence as JSON and does not depend on or mutate
`ArchitectureGraph`. The fixture and real-corpus tests are respectively:

```text
tests/spikes/javaSemanticFeasibility.test.ts
tests/acceptance/fragmentsJavaSemanticFeasibility.test.ts
```

The real acceptance defaults to `../fragmentsClean` and can be redirected with
`FLOWATLAS_FRAGMENTS_BACKEND_ROOT`. It is skipped when that corpus is absent.

### Resolution-context decision

Source-only analysis produced otherwise useful results but also unresolved
third-party annotations and generated-code diagnostics. The accepted mode is
therefore source analysis assisted by the complete Maven dependency classpath
and available compiled project classes. This bytecode is resolution context,
not architectural scan scope: emitted evidence still comes only from explicit
source inputs.

The engine must expose compiler diagnostics rather than silently converting
error types into architecture. Lot 02 implements this boundary in the isolated
project-context spike.

## Lot 02 project-context result

The Maven project context remains isolated in
`scripts/javaMavenSemanticContext.mjs`; it is not a production scanner port.
It composes the Lot 01 JDK probe with:

- Java release discovery from `maven.compiler.release`, `java.version` or
  `maven.compiler.source` properties;
- dependency classpath discovery through the project Maven wrapper, or local
  Maven when no wrapper exists;
- available `target/classes` bytecode as resolution assistance;
- a normalized source root and explicit `scanSources`;
- optional `resolutionSources` that help compilation without entering scan
  scope;
- structured compiler diagnostics with source location and scope membership.

Every returned source location includes `inScanScope`. This is deliberately
evidence metadata, not an intermediate architecture model. The controlled
fixture proves that a missing type remains a visible scoped diagnostic while
out-of-scope events can still be resolved. The Fragments acceptance proves the
same boundary without diagnostics: only the ticket process manager is in scan
scope while its event, handler-interface and provider types resolve from the
broader Maven context.

The current spike is intentionally limited to the single-module Maven shape
observed in Fragments: one configured main source root, Maven properties for
the Java release and the conventional `target/classes` output. Multi-module
reactors, profiles and generated source roots need later real evidence.

## Known gaps

- The selected JDK compiler API has not entered the production scanner.
- Maven/classpath loading and architectural scan scope are proven only in the
  isolated spike, not the production scanner.
- The exact representation of the domain-event-to-integration-event mapping
  must be derived from the outbox acceptance without inventing Event-to-Event
  causality.
- The first trustworthy State granularity must come from a projection
  acceptance; discovering a SQL table is not sufficient.
- The current scanner facade is TypeScript-specific. A new structural adapter
  boundary will be proposed only if the feasibility acceptance demonstrates a
  real need.
- Spring configuration can create handlers through factories, lambdas and
  collections. These forms are required Fragments evidence, not permission to
  build a general dependency-injection simulator.

## Lot 04 result

The explicitly approved option A promotes scanning to an application port:

```text
ArchitectureScanner.scan({ projectPath })
  -> ArchitectureGraph
  -> language-neutral diagnostics
```

The TypeScript and Java adapters remain independent. Scan-scope configuration,
Maven, javac, `tsconfig`, compiler caches and Redux conventions do not enter the
port. The MCP consumes the port without a public protocol change; Java remains
unexposed through CLI/MCP until the dedicated integration lot.

The Fragments `WriteTicketController#verify` mapping and resolved dispatch
produce a protocol Event, a controller Handler and a Command Event.
`CommandHandler<VerifyTicketCommand>` independently proves the command-handler
listener. Both branches meet at the same Command identity without simulating
the runtime `CommandBus` registry.

## Next investigation

Lot 05 may investigate the outbox boundary from one real producer domain event
to destination/version-specific integration events and SQS or inbox handlers.
It must preserve any gap that cannot be justified from mappings, envelopes and
routes.

Direct publication is not general interprocedural propagation. Helpers that
capture publishers, injected gateway calls and discriminated branches remain
future acceptance cases. Branches may enrich evidence or diagnostics, but do
not justify new graph kinds or speculative causal edges.

## Engine references

- [JDK 21 `Trees` API](https://docs.oracle.com/en/java/javase/21/docs/api/jdk.compiler/com/sun/source/util/Trees.html)
  and [compiler tree utilities](https://docs.oracle.com/en/java/javase/21/docs/api/jdk.compiler/com/sun/source/util/package-summary.html)
- [JavaParser and JavaSymbolSolver](https://github.com/javaparser/javaparser/blob/master/readme.md)
- [Spoon launchers and `MavenLauncher`](https://spoon.gforge.inria.fr/launcher.html)
- [Eclipse JDT `ASTParser`](https://help.eclipse.org/latest/ntopic/org.eclipse.jdt.doc.isv/reference/api/org/eclipse/jdt/core/dom/ASTParser.html)
