declare function createAction(type: string): () => unknown;
declare function isAnyOf(...events: unknown[]): unknown;
declare function createSlice(configuration: unknown): unknown;

const notificationsReceived = createAction("notifications/received");
const matchNotificationsReceived = isAnyOf(notificationsReceived);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {},
  extraReducers: (builder: { addMatcher(matcher: unknown, reducer: unknown): unknown }) => {
    builder.addMatcher(matchNotificationsReceived, (state: unknown) => state);
  },
});

void notificationsSlice;
