import { createAppAsyncThunk } from "./typedAsyncThunkFactory.js";

export const login = createAppAsyncThunk("auth/login", async (username: string) => username);
