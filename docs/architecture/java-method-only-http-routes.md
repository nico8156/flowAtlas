# Java method-only HTTP routes

Iteration: **BEHAVIOUR**, local Java semantic detector correction.

The Fragment Admin feedback exposed a scanner restriction: a controller method
with a full `@PostMapping` path could not be scanned without class-level
`@RequestMapping`. Spring permits method-level mappings; class-level mappings
express shared path prefixes. See the
[Spring MVC mapping reference](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html).

## Behavior and boundary

The first fixture has `@PostMapping("/api/tickets/verify")` and no class mapping.
Its initial scan failed with `Could not resolve configured HTTP mapping
annotations` (**RED**). The Java semantic detector now uses an empty prefix when
the configured class mapping annotation is absent. An explicitly present mapping
still goes through the existing path resolver; an unresolved method mapping
still fails. Graph vocabulary, graph directions and public request configuration
are unchanged.

Two additional fixture checks pin existing behavior: compose class and method
paths into `/api/tickets/verify`, and reject an unmapped method even when it
dispatches the configured command. No route is inferred from method names.

The real Fragment acceptance scans the moderation controller and typed command
handler. It then copies the Maven source tree into a temporary directory, removes
the controller's `/api/admin` class mapping and prefixes the method mappings with
that same path. Both scans must produce the same topology, including the expected
four nodes and three relations. Source locations may differ in the copy and are
not compared as topology. The original corpus is never edited.

Set `FLOWATLAS_FRAGMENTS_BACKEND_ROOT` to select another checkout. The acceptance
skips when the moderation controller is absent. This checks an equivalent source
variant of the current controller, not the historical backend snapshot.

This cycle does not add inherited mappings, composed custom annotations,
multiple-path expansion or new empty-annotation semantics. The existing explicit
Java request and bounded architectural scan scope remain in use. The graph does
not prove HTTP authorization, transactionality or command execution at runtime.

## Targeted mutation evidence

Manual mutations were executed independently against
`tests/acceptance/javaMethodOnlyHttpCommandGraph.test.ts`, using `--maxWorkers=1`
and `-t` to select the affected example:

- Replace the absent-class empty prefix with `null`: the method-only scan fails
  with the original mapping diagnostic (**KILLED**).
- Always clear the class prefix: the composition PIN receives `/verify` instead
  of `/api/tickets/verify` (**KILLED**).
- Replace an unresolved method path with `/`: the unmapped-method PIN observes
  a successfully invented root route instead of a rejection (**KILLED**).

The unmutated three-example baseline passed before mutation. Each mutation was
restored with `finally`; there were no survivors or compiler/setup kills.
Final verification reruns the restored code and the real moderation acceptance.

## Final verification

The relevant combined run covered 78 tests: the complete scanner suite, the HTTP
semantic-context spike, method-only fixtures, Fragment ticket/moderation routes
and Java CLI export. It passed 77 tests and exposed a request-setup problem in
the new moderation acceptance: implicit resolution could select a compiled
Command without a source location. Adding the Command file to `resolutionSources`
fixed that setup; the corrected acceptance passed on replay. Production code did
not change during that correction.

Typecheck, lint, formatting and build pass. Whole-repository corpus suites were
not rerun; the separate Dogs Out outbox failure recorded in the namespace cycle
remains outside this route change. There are no temporary mutations remaining.
