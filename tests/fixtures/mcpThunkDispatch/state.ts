declare function createSlice(configuration: unknown): {
  actions: { itemSelected: () => unknown; itemRemoved: () => unknown };
};

export const itemsSlice = createSlice({
  name: "items",
  initialState: {},
  reducers: {
    itemSelected: () => undefined,
    itemRemoved: () => undefined,
  },
});

export const { itemSelected, itemRemoved } = itemsSlice.actions;
