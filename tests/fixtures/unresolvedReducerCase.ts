declare function createAction(type: string): () => unknown;

declare function missingEvent(): unknown;

declare function createReducer<State>(
  initialState: State,
  builder: (builder: { addCase(event: unknown, reducer: unknown): unknown }) => unknown,
): unknown;

const knownEvent = createAction("KNOWN_EVENT");
const initialState = {};

const stateReducer = createReducer(initialState, (builder) => {
  builder.addCase(knownEvent, (state: typeof initialState) => state);
  builder.addCase(missingEvent, (state: typeof initialState) => state);
});

void stateReducer;
