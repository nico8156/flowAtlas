declare function createAction(type: string): unknown;

declare function createReducer<State>(
  initialState: State,
  builder: (builder: { addCase(event: unknown, reducer: unknown): unknown }) => unknown,
): unknown;

const likeOptimisticApplied = createAction("LIKE/OPTIMISTIC_APPLIED");
const initialState = { byTarget: {} };

const likeWlReducer = createReducer(initialState, (builder) => {
  builder.addCase(likeOptimisticApplied, (state: typeof initialState) => state);
});

void likeWlReducer;
