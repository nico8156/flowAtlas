# Fragment Admin: namespace listener imports

Iteration: **BEHAVIOUR**, local TypeScript scanner adapter correction.

The admin feedback exposed missing listener relations when actions were imported
through a namespace. Named imports made those relations visible, but adapting the
application to the scanner is not the intended exploration workflow.

The focused fixture checks two registrations, a dispatch, homonymous exports in
another module and an unresolved export. Its first run returned no relations
instead of the three expected relations (RED). The resolver now binds namespace
exports to the exact Event declaration identified by the TypeScript checker.
The listener detector accepts those proven references for registration identities,
`LISTENS_TO` and `DISPATCHES`. Unresolved properties remain omitted.
An additional RED exposed a dangling listening relation when the imported Event
was available only in resolution context. Listening relations now require an
Event present in the scanned graph; the fixture checks this scope boundary.

The real-corpus acceptance reads Studio's community listeners and compares the
outgoing relations of `communityOpened`, `communityCommandChanged` and
`communityCommandCheckRequested` against an in-memory namespace-import variant.
Both forms produce the same relations, and opening the community does not invent
a command-check dispatch. The external repository is never modified. Set
`FLOWATLAS_FRAGMENTS_STUDIO_ROOT` to select another checkout; the test skips when
the corpus is absent. This checks those registrations, not complete application
coverage or the exact namespace source from the initial failed exploration.

## Targeted mutation evidence

Manual mutations executed independently and restored with `finally`:

- Replace namespace binding insertion with deletion: the focused test fails
  because all three expected relations disappear (**KILLED**).
- Invert the namespace dispatch binding check: the focused test fails because
  the expected `DISPATCHES` relation disappears (**KILLED**).
- Remove the listening target guard: the scope example fails because scanning
  throws instead of omitting the out-of-scope relationship (**KILLED**).

Command: `npx vitest run tests/scanner/namespaceListeners.test.ts`.
The unmutated focused baseline passed before mutation. No survivor or new PIN
was needed. Final verification reruns the restored sources.

## Verification

The full scanner suite passes (16 files, 70 tests), as do the Studio acceptance
and the real Fragments CLI context acceptance run with one worker. Typecheck,
lint, format and build are checked separately.

Whole-repository runs were interrupted after corpus/CLI timeouts, including a
CLI context timeout that passed in isolation. They are not claimed green.
The Dogs Out magic-link outbox acceptance fails with the same routing diagnostic
on an isolated copy of the original commit as on the changed code. That separate
Java corpus failure remains unresolved by this TypeScript cycle.

## Separate Java finding

The backend change `ae44d90` introduced class-level `@RequestMapping("/api/admin")`
and the direct experience moderation endpoint. Its predecessor already had a
method-level full-path `@PostMapping`, but no class-level `@RequestMapping`.
`JavaSemanticSpike.java` currently requires both mapping annotations. This is a
concrete scanner limitation for method-only routes; the annotation is not
generally required for a Spring controller with a full method path.

No Java detector behavior changes in this cycle. A method-only route fixture
would be a separate bounded behavior cycle. No cross-language or SSE causality
is inferred, and database/API guarantees remain integration-test responsibilities.
