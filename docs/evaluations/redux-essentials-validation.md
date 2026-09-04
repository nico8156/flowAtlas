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
Events. Generated RTK Query matchers therefore remain absent. State detection
also accepts the equivalent object-method form `extraReducers(builder) { ... }`
used by the official slice.

After these three local corrections, the notification acceptance is GREEN: the
Event and registered State are present, their `UPDATES` relation is present and
no relation to the unrelated `auth` State is invented.

The RTK Query lifecycle callback and WebSocket boundary are deliberately out of
scope for this Redux-only validation and are not promoted to Handler or External
concepts.

## Handwritten thunk slice

`fetchNotificationsWebsocket` is a handwritten Redux thunk factory. FlowAtlas
recognizes it as a `Handler` and now records its exact declaration at
`src/features/notifications/notificationsSlice.ts:78`. The thunk body does not
dispatch an Event, so the acceptance requires no outgoing Redux relation. Its
call to the mock notification server remains outside this Redux-only slice.

This second acceptance is GREEN and demonstrates that an isolated Handler can
still orient source exploration without invented causality.

## Async thunk slice

The reviewed Redux contract represents a `createAsyncThunk` declaration as a
Handler that can dispatch the three lifecycle Events guaranteed by Redux
Toolkit:

```text
login --DISPATCHES--> login.pending
login --DISPATCHES--> login.fulfilled
login --DISPATCHES--> login.rejected
```

Direct `createAsyncThunk` declarations now produce this topology with source
locations. The official application wraps the factory through
`createAsyncThunk.withTypes()` and imports the resulting `createAppAsyncThunk`;
resolving that typed alias remains the next acceptance gap. Calls performed by
the payload creator stay outside this Redux-only slice.
