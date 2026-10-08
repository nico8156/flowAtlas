import { createAppAsyncThunk } from "../typedAsyncThunkFactory.js";
import { itemSelected as selectItem, itemRemoved } from "./state.js";

declare function unresolvedAction(): unknown;

export const loadItems = createAppAsyncThunk(
  "items/load",
  async (_input: unknown, { dispatch }: { dispatch: (action: unknown) => void }) => {
    dispatch(selectItem());
    dispatch(unresolvedAction());
  },
);

export const removeItem = createAppAsyncThunk(
  "items/remove",
  async (_input: unknown, { dispatch }: { dispatch: (action: unknown) => void }) => {
    dispatch(itemRemoved());
  },
);
