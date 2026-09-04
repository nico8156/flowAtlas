declare function createAction(type: string): () => unknown;
declare function createSlice(configuration: unknown): unknown;

const notificationsReceived = createAction("notifications/received");

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {},
  extraReducers(builder: { addCase(event: unknown, reducer: unknown): unknown }) {
    builder.addCase(notificationsReceived, (state: unknown) => state);
  },
});

void notificationsSlice;
