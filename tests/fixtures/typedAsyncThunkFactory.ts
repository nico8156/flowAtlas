declare const createAsyncThunk: {
  withTypes<TypeConfiguration>(): (
    type: string,
    payloadCreator: unknown,
  ) => { typeConfiguration?: TypeConfiguration };
};

export const createAppAsyncThunk = createAsyncThunk.withTypes<{ state: unknown }>();
