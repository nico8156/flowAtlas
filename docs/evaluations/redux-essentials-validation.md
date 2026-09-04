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

The acceptance remains RED because state relationship detection supports
`addCase` but not the official `addMatcher(isAnyOf(...))` form. This is recorded
as the next local detector gap. The RTK Query lifecycle callback and WebSocket
boundary are deliberately not promoted to Handler or External concepts by this
acceptance; doing so would require separate evidence and review.
