declare function createSlice(configuration: {
  name: string;
  initialState: object;
  reducers: Record<string, (state: object, action?: unknown) => void>;
}): { actions: { sessionAuthenticated: () => unknown } };

type Dispatch = (action: unknown) => void;

export const authenticationSlice = createSlice({
  name: "authentication",
  initialState: {},
  reducers: {
    sessionAuthenticated: () => undefined,
  },
});

const sessionAuthenticated = authenticationSlice.actions.sessionAuthenticated;

export const createAuthenticationEvents = (dispatch: Dispatch) => ({
  authenticated: () => dispatch(sessionAuthenticated()),
});
