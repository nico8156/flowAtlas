# Dogs Out: configured MCP replay

Date: 8 October 2026. Status: **DELIVERED — milestone 1**.
Iteration: `CHORE`; route: operational verification and documentation.

## Goal and acceptance driver

Replay the September Dogs Out feedback through the locally configured MCP,
identify the executable scanner and corpus, and distinguish current capability
from request scope and remaining scanner gaps. Every reported path must have
either a reproducible projection or a precise limitation. This milestone does
not change scanner behavior or the canonical graph.

The [recorded calls and responses](dogs-out-mcp-replay-2026-10-08.json) contain
17 actual calls to the configured `flowatlas_find_nodes` and
`flowatlas_get_context` tools. Fourteen returned structured results, including
two intentionally empty searches; three returned the expected errors for
invalid inputs. All eleven contexts fit their budgets, with `complete=true`,
`frontierComplete=true`, and application coverage explicitly `not-assessed`.

## Scanner and corpus identity

- Configured command: `node {FLOWATLAS_ROOT}/dist/mcp.js`, read from the local
  Codex MCP configuration. Tool calls used that configured connection.
- FlowAtlas source: `57315e1f3c29bdb2cd814ea52b7f22fb0429e2fa`.
- Dogs Out source: `8858c30a19f34ac891819d119073f29ef770ab2b`.
- Both Git worktrees were clean before recording documentation.
- Node: `v22.16.0`; Java: OpenJDK `23-valhalla+1-90`.
- [Provenance](dogs-out-mcp-replay-2026-10-08-provenance.json) records SHA-256
  hashes of configured JavaScript, Java analysis scripts, request files and
  dependency manifests, plus the existing Java bytecode manifest.

A fresh build was produced outside `dist` using
`npx tsup --out-dir /private/tmp/flowatlas-jalon1-build`. All nine configured
JavaScript files matched fresh-build files after normalizing generated
`chunk-[A-Z0-9]+` references and removing `sourceMappingURL` comments. The
configured build was not replaced during the replay.

This establishes normalized build/source agreement, not byte-for-byte equality
or an attestation of the running process's startup commit. MCP reports package
version `0.1.0`, which does not identify a Git revision. Java analysis also uses
the current source scripts and Maven classpath, including `target/classes`;
643 existing class files were fingerprinted. This replay did not rebuild Dogs
Out or prove that every existing class file was compiled from the pinned source.

## Results against the feedback

All contexts use `direction=both`, depth 3, at most 40 nodes, 80 edges and
16,384 serialized bytes. Counts describe the current corpus, not a permanent
scanner contract.

| Path / focus                                         | Request                                     | Nodes / edges | Verified result and boundary                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startWalk`                                          | TypeScript `mobile`                         | 11 / 12       | Three lifecycle Events update `walkSlice`; six `CALLS_EXTERNAL` edges include `LocationGateway`, `CommandIdGenerator` and `WalkGateway`. Additional boundaries are present in the evolved source. |
| `dogSlice`                                           | TypeScript `mobile`                         | 5 / 4         | Four slice action Events update State. Store composition, `preloadedState` and selector consumption remain absent.                                                                                |
| `authenticationSlice`                                | TypeScript `mobile`                         | 11 / 17       | `createAuthenticationEvents` dispatches eight Events; nine Events update State. The coordinator and its gateway/vault path remain outside this projection.                                        |
| `loadOnboarding`                                     | TypeScript `mobile`                         | 7 / 8         | Lifecycle plus `OnboardingGateway` and `SessionVault` are present. Explicit cross-slice action dispatches remain absent.                                                                          |
| `nearbyDogsSlice`                                    | TypeScript `mobile`                         | 5 / 6         | Lifecycle and slice updates reproduce the successful September observation.                                                                                                                       |
| `CurrentWalkView`                                    | FlowAtlas WalkStarted fixture request       | 2 / 1         | `WalkStarted --UPDATES--> CurrentWalkView`, without a sync Event. The dispatcher is absent; this is the local mutation proof.                                                                     |
| `local-outbox:MagicLinkDeliveryRequested`            | FlowAtlas magic-link fixture request        | 2 / 1         | The local consumer `LISTENS_TO` the configured route. Producer publication and delivery to SES are absent.                                                                                        |
| `java-client:…SesV2Client#sendEmail`                 | FlowAtlas SES fixture request               | 2 / 1         | `DeliverMagicLinkService#deliver(…) --CALLS_EXTERNAL-->` SES. The outbox consumer and producer are separate slices.                                                                               |
| `DailyWalkGoal`                                      | Dogs Out versioned M8.1 request             | 2 / 1         | `DailyWalkGoalConfigured --UPDATES--> DailyWalkGoal`. The request declares only this mutation; it does not request `DailyWalkProgress`.                                                           |
| `DailyWalkGoalConfiguredProjectionHandler#handle(…)` | Same M8.1 request                           | 1 / 0         | Handler discovery succeeds, but its context has no edges. Start from the State or Event to inspect the proven mutation.                                                                           |
| `NearbyDogView`                                      | Dogs Out account-deletion request, Git root | 2 / 1         | `AccountDeleted --UPDATES--> NearbyDogView`. The Git root correctly selects the sole direct Maven child, `backend`.                                                                               |

The multi-projection acceptance separately constructs a temporary variant of
the M8.1 request with two `projectionMutations`, and proves both
`DailyWalkGoal` and `DailyWalkProgress`. Passing that acceptance does not mean
the versioned single-mutation request exposes both States.

The source `onboardingThunks.ts` directly dispatches `dogsLoaded`,
`onboardingCompleted` and `becameAnonymous` from `loadOnboarding`. None of those
`DISPATCHES` edges appears in its MCP context. This is an observed detector
gap, independently of store-composition semantics. In this corpus,
`dogSelected` is dispatched by `createGuardianDog`, not `loadOnboarding`.

The magic-link fixture targets `LocalOutboxHandlerRegistry#handle`, which
invokes the handler contract. It does not prove dispatcher delegation to that
registry, publication by `RequestMagicLinkService`, collective acknowledgement,
or the asynchronous delivery chain. A search for `RequestMagicLinkService`
within this request returns no matches.

Searching `WalkExpired` with the M8.1 request also returns no matches: its scan
scope contains only the Daily Walk Goal projection handler. This is an
out-of-request search, not evidence that Dogs Out has no expiration path.
The repository has a tested `@Scheduled` detector, but this replay does not
establish Dogs Out scheduler-to-PostgreSQL/SES/Expo coverage.

## Invalid-input replay

Three failures were deliberately exercised through MCP:

1. A Java call without `requestPath`: `Java scans require an explicit requestPath`.
2. A temporary WalkStarted request with an additional nonexistent resolution
   source: the response identifies `com/nm/dogsout/MissingReplayPort.java` and
   the request path.
3. A temporary WalkStarted request selecting `missingReplayMutation`: the
   response names `SaveCurrentWalkViewPort#missingReplayMutation` and reports
   that an invocation with an event-derived argument could not be proven.

None returned a graph, printed a generated command/classpath, or used the
generic `stale or incomplete` label. The historical null-`source` failure was
not reproduced with these executable requests; its original invalid request
was not retained, so its exact cause cannot be reconstructed from the report.

## Reproduction

Check out the pinned repositories and install their declared dependencies.
Provide the JDK and Maven context required by the Java adapter; see the
bytecode qualification above. Build FlowAtlas with `npm run build`, register
`node {FLOWATLAS_ROOT}/dist/mcp.js` in the MCP client and open a fresh connection.

Replace `{FLOWATLAS_ROOT}`, `{DOGS_OUT_ROOT}` and `{TEMP_ROOT}` in the recorded
call arguments with the corresponding absolute paths. Invoke the recorded
tool with those arguments and inspect `structuredContent` or `isError`.
The JSON is a historical transcript, not an automatically executed test suite.
No CLI scan was used to duplicate a successful MCP projection.

For the two deliberately invalid request files, copy
`tests/fixtures/dogs-out-java-walk-projection-request.json` to `{TEMP_ROOT}`:

- `flowatlas-jalon1-missing-source.json`: append
  `com/nm/dogsout/MissingReplayPort.java` to `resolutionSources`.
- `flowatlas-jalon1-unproven-mutation.json`: replace
  `projectionMutationMethod` with `missingReplayMutation`.

Keep invalid requests temporary. The normal Java requests used here are
already versioned in their owning repositories; Dogs Out was not modified.

## Verification and next decision

Relevant regression command:

```sh
npx vitest run tests/acceptance/dogsOut* tests/mcp/flowAtlasMcpServer.test.ts tests/scanner/javaMavenArchitectureScanner.test.ts --maxWorkers=1 --minWorkers=1
```

The replayed regression scope passed: **9 files, 15 tests, no skips**,
including all seven real Dogs Out acceptances. Documentation validation includes JSON parsing, transcript checks against the
observed graph assertions and expected failures, local-link checks,
`git diff --check`, and Prettier. The temporary fresh build passed. Targeted
mutation testing is **NOT APPLICABLE**: this is an operational/documentation
chore with no production behavior change. A full-repository test pass is not
claimed by this milestone.

Milestone 1 establishes that the current configured MCP works for these bounded
requests. Proposed milestone 2 remains request maintenance and diagnostic
precision. Its review should account for the already useful missing-file and
unproven-mutation errors, lack of process revision metadata, and dependence on
explicit request scope. The newly reproduced cross-slice thunk dispatch gap
is a candidate for a separate behavior cycle. No next milestone is started.
