# Java Semantic Feasibility

Date: 11 September 2026.

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
| 01  | PROPOSED  | Compare Java semantic engines on one fixture and the pinned acceptance source, then select one with evidence.     |
| 02  | PROPOSED  | Load a Java project with full resolution context and bounded architectural scan scope.                            |
| 03  | PROPOSED  | Detect domain events, typed local handlers and statically proven publication.                                     |
| 04  | PROPOSED  | Add HTTP protocol signals, commands and typed command handlers after replaying the first event acceptance.        |
| 05  | PROPOSED  | Reconstruct outbox mapping, public integration identities, destinations, SQS routes and inbox-backed consumers.   |
| 06  | PROPOSED  | Detect event-fed projection State and Projection Sync signals.                                                    |
| 07  | PROPOSED  | Detect resolved external execution, communication and persistence boundaries.                                     |
| 08  | PROPOSED  | Validate bounded Fragments projections and expose Java through the existing CLI and MCP application capabilities. |
| 09  | LONG TERM | Generalize only from additional real corpora and repeated evidence.                                               |

Each proposed lot requires its own acceptance or focused behavioral RED and is
not authorized by this document. Work stops after completing each lot.

## Known gaps

- The semantic engine has not been selected. JavaParser with Symbol Solver,
  Spoon, Eclipse JDT and the Java compiler APIs remain candidates.
- Source-only resolution versus a bounded bytecode fallback is not decided.
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

## Next investigation

Lot 01 may introduce an isolated spike and fixtures only. It will compare the
smallest useful semantic queries:

1. assignability to `DomainEvent`;
2. recovery of the `E` type argument from `EventHandler<E>`;
3. resolution of the provider method invoked by the process manager;
4. source locations and fully qualified identities under a Maven Java 21
   project context.

The engine decision and observed limitations must be reviewed before any Java
detector enters the production scanner.
