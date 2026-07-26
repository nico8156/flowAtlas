# FlowAtlas

FlowAtlas transforms an event-driven architecture into a navigable map.

> FlowAtlas is an architecture map, not a call graph.

The canonical model will remain independent from TypeScript analysis, Redux,
the filesystem, the CLI, and any UI framework. Redux Toolkit is the first
analysis target, not the domain model.

## Bootstrap scope

This repository currently contains only the development foundation:

- strict TypeScript;
- Node.js ESM package configuration;
- tsup build pipeline;
- Vitest test runner;
- ESLint and Prettier;
- a source entry point with no business behavior.

The first domain capability will be introduced through a single RED test,
validated before implementation, and developed one RED/GREEN step at a time.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
npm run lint
npm run format
```

## Planned boundaries

The project will grow around a small hexagonal/Clean Architecture core:

- domain and application code will not depend on analysis tools or delivery mechanisms;
- TypeScript/Redux detectors will be adapters;
- the CLI will be a primary adapter;
- the visualizer will be a later adapter.

No domain model, scanner, Redux detector, visualizer, or Fragments fixture is
created during bootstrap.
