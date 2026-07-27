import { likeWlReducer as lState } from "./aliasedStoreReducer.js";

declare function configureStore(configuration: unknown): unknown;

const store = configureStore({
  reducer: {
    lState,
  },
});

void store;
