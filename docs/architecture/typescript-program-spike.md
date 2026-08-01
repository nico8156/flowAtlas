# TypeScript Program / TypeChecker Spike

## Status

Active investigation. This document records an isolated experiment; it does
not authorize a production scanner migration.

## Question

Can FlowAtlas delegate TypeScript semantics to a shared `Program` and
`TypeChecker`, so that FlowAtlas spends less code and CPU rebuilding imports,
aliases, symbols and interface declarations while keeping architectural
interpretation in its own detectors?

## Current pipeline

The current adapter:

1. loads the project files and tsconfig;
2. creates `SourceFile` instances with `ts.createSourceFile`;
3. resolves import paths and aliases itself;
4. builds a FlowAtlas semantic index for function-like declarations, aliases
   and interfaces;
5. runs discovery and relationship passes over the architectural scan scope;
6. performs bounded propagation for external boundaries;
7. mutates the strict `ArchitectureGraph` only for justified relationships.

The main known duplication is that resolution creates source files and the
source scanner can recreate them. The current scanner also retains name-based
fallbacks because its indexes are built from source text rather than compiler
symbols.

## Spike

Run the isolated experiment with:

```bash
npm run spike:typescript -- ../fragmentsCleanFront
```

The script builds a TypeScript `Program` from the Fragments tsconfig, obtains
one `TypeChecker`, and checks:

- a real renamed import (`cState` -> `commentWlReducer`);
- a controlled homonymous-module fixture, because the real project did not
  contain duplicate function declarations suitable for this case;
- the real `likesRetrieval` expression `likeGateway.get`, including its
  `LikeWlGateway` interface and `get` method declaration.

It also measures Program creation, checker access, selected lookups and a
large repeated identifier-query pass. The latter is a stress signal, not a
direct comparison with the FlowAtlas scan.

## Observed run

Environment: repository TypeScript 5.8.3, Fragments project with 342 config
files and 341 non-declaration source files.

| Measurement                              | Observed |
| ---------------------------------------- | -------: |
| Read/parse tsconfig                      |   ~85 ms |
| `ts.createProgram`                       |  ~2.76 s |
| `program.getTypeChecker()`               |  ~0.77 s |
| Renamed import lookup                    |   ~10 ms |
| `LikeWlGateway` type/method lookup       |  ~0.39 s |
| 47,052 identifier symbol queries         |  ~2.40 s |
| Current FlowAtlas CLI scan, same project |  ~9.74 s |

The current scan timing was measured separately with:

```bash
npm run build
/usr/bin/time -p node dist/index.js scan ../fragmentsCleanFront
```

These numbers do not yet establish a speedup. The spike performs semantic
queries but does not build an ArchitectureGraph, and the current scanner has
not been instrumented by phase. The next valid performance comparison must
run equivalent graph production through both paths and report loading,
discovery, relationship analysis, external resolution and graph construction
separately.

## What TypeScript can replace

`Program` and `TypeChecker` can provide:

- stable symbol identity across renamed imports and modules;
- alias unwrapping from local symbol to original declaration;
- declaration/source-file locations;
- type identity for variables and parameters;
- interface and method declarations;
- homonym disambiguation without a global name-only fallback.

For the real `likesRetrieval` code, the checker resolves:

```text
likeGateway
  -> LikeWlGateway
  -> gateway.get MethodSignature
```

## What remains FlowAtlas-owned

TypeScript does not decide that a declaration is an Event, Handler, State or
External. It also does not decide which source files belong to the
architectural scan scope, whether a helper crosses a meaningful external
boundary, or which bounded propagation is useful for the architecture map.

In particular, the outbox path remains architectural analysis:

```text
processOutboxFactory
  -> getOutboxCommandGateway
  -> local `gw`
  -> sendOutboxCommand({ gateway: gw })
  -> gateway.add/remove
```

The checker can resolve the types and declarations involved, but FlowAtlas
still has to follow this limited orchestration and emit one
`CALLS_EXTERNAL` edge without promoting helpers into graph nodes.

## Recommendation

Adopt `Program + TypeChecker` selectively, after a second spike that routes a
small detector through the shared compiler context and compares identical
graph output. Do not replace the entire scanner, introduce an intermediate
facts model, or build a generic call graph.

The smallest credible migration target is:

1. create one shared compiler context per scan;
2. reuse its `SourceFile` instances;
3. use checker identity for imports, aliases, declarations and external
   interface/method lookup;
4. retain FlowAtlas detectors and bounded external propagation;
5. remove a manual resolver only when a regression test and measurements show
   that the checker path covers its responsibility.

The spike is therefore positive for correctness and architectural simplicity,
but inconclusive for CPU until equivalent end-to-end measurements exist.

## Phase 2 — Shared Compiler Context

The first production slice is now implemented behind the scanner adapter:

- one in-memory compiler host builds a `Program` per project scan;
- the returned `SourceFile` instances are shared by symbol resolution and the
  project scanner passes;
- a `TypeChecker` is created once and retained for the next selective resolver
  migration;
- the domain, graph vocabulary, detectors' architectural semantics and scan
  scope remain unchanged.

The same Fragments CLI scan measured approximately **8.51 seconds** after
this slice, versus **9.74 seconds** before it on the same local setup. This is
an encouraging but not yet causal performance result: the current scanner
still performs its existing AST-based lookups, and phase-level instrumentation
is not yet available.

The next safe migration target is one resolver responsibility at a time,
starting with renamed import/symbol identity. Each migration must preserve the
existing graph and compare the TypeChecker path against the current resolver
before the manual path is removed.

The first selective migration is now in place: imported Event bindings consult
the checker to unwrap aliases and identify the original declaration. The
existing path-based resolver remains as a fallback for unresolved symbols, so
the scanner stays tolerant and no graph invariant is relaxed.

The full suite remains green at 113 tests. A subsequent direct scan measured
approximately **8.73 seconds**; this is within the expected run-to-run noise
of the previous 8.51-second measurement and should not be treated as a
meaningful regression or improvement.

External interface method support is now checker-backed when available: the
semantic index obtains declared interface properties from TypeScript and
retains AST member collection as a fallback. This changes the source of
semantic information, not the `CALLS_EXTERNAL` interpretation. The full suite
remains green at 113 tests and the latest direct scan measured approximately
**8.65 seconds**, with no meaningful CPU conclusion yet.

The next bounded type-alias lookup now consults the shared semantic index
before falling back to an AST search. A direct Fragments scan then measured
approximately **6.02 seconds**. This is a promising signal, but still not a
controlled phase benchmark because the scanner has no per-stage timing yet.

One full-suite run also exposed an existing test orchestration race: multiple
CLI acceptance tests build concurrently while `tsup` cleans `dist`. The
affected `cliScan` test passes when run after a completed build; this race is
tracked separately and is not attributed to the resolver change.

## Phase instrumentation

`FLOWATLAS_PROFILE=1` now enables optional scan-phase timings on stderr. The
default CLI output and graph are unchanged. A Fragments run reported:

| Phase              | Observed |
| ------------------ | -------: |
| compiler context   |  ~2.01 s |
| Event identities   |   ~18 ms |
| semantic index     |   ~37 ms |
| import bindings    |   ~52 ms |
| State discovery    |  ~204 ms |
| discovery pass     |  ~201 ms |
| relationship pass  |  ~2.41 s |
| total process scan |  ~6.08 s |

The two dominant measured phases are compiler-context construction and the
relationship pass. This argues against further micro-optimizing alias lookup
in isolation. The next investigation should determine whether the
relationship pass repeatedly traverses the same declarations, then decide
whether selective checker use there is justified. No facts/IR model should be
introduced from this measurement alone.

The detector-level profile now explains the relationship cost more precisely:

| Relationship detector | Observed |
| --------------------- | -------: |
| External              |   ~18 ms |
| Event                 |   ~19 ms |
| Listener              |  ~2.65 s |
| State                 |   ~19 ms |

Listener detection is therefore the current hot path by a wide margin. The
next investigation should inspect repeated function/external resolution from
`listenerDetector` before changing the compiler architecture. No optimization
is justified from the aggregate relationship timing alone.
