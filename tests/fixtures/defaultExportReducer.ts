declare function createSlice(configuration: unknown): { reducer: unknown };

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {},
  reducers: {},
});

export default notificationsSlice.reducer;
