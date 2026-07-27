declare function createReducer<State>(
  initialState: State,
  builder: (builder: unknown) => unknown,
): unknown;

const initialState = { byTarget: {} };

export const likeWlReducer = createReducer(initialState, (builder) => builder);
