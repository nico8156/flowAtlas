# Redux Essentials Validation

## Corpus

The external acceptance uses the official `reduxjs/redux-essentials-example-app`
repository on its `tutorial-steps-ts` branch, pinned during discovery at commit
`ec4657debf4e516a88bb91839fcc894d735a5a2e`.

The default branch was rejected as a validation corpus because it contains only
the tutorial scaffold and no Redux architecture. The selected branch contains
Redux Toolkit slices, typed async thunks, RTK Query, listener middleware,
WebSocket lifecycle code and reducers registered through default imports.

The repository is not vendored into FlowAtlas. The optional acceptance runs
when `FLOWATLAS_REDUX_ESSENTIALS_ROOT` points to a local checkout.

## First acceptance slice

The notification slice declares `notificationsReceived` with `createAction`,
dispatches it from an RTK Query WebSocket lifecycle callback and consumes a
matcher containing that Event to update the registered `notifications` State.
The smallest expected projection is:

```text
notificationsReceived --UPDATES--> notifications
```

No relation from that Event to `auth` is expected.

## Observed gaps

The first scan found the Event but represented the State as
`notificationsSlice`. The store imports `notificationsSlice.reducer` through a
default export under the local name `notificationsReducer`; the existing import
resolver handled named imports only. Resolving that statically visible default
export now gives the State its registered identity, `notifications`.

State relationship detection now resolves local `isAnyOf` declarations passed
to `addMatcher` and retains only arguments that already resolve to canonical
Events. Generated RTK Query matchers therefore remain absent. The official
slice also declares `extraReducers` with object-method syntax; support for that
syntax is a separate local detector gap to verify on the next acceptance replay.

The RTK Query lifecycle callback and WebSocket boundary are deliberately out of
scope for this Redux-only validation and are not promoted to Handler or External
concepts.
