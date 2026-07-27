declare function createReducer<State>(
  initialState: State,
  builder: (builder: unknown) => unknown,
): unknown;

const initialState = { byTarget: {} };

const likeWlReducer = createReducer(initialState, (builder) => builder);

void likeWlReducer;
