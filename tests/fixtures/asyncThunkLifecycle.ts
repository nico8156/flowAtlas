declare function createAsyncThunk(type: string, payloadCreator: unknown): unknown;

export const login = createAsyncThunk("auth/login", async (username: string) => username);
