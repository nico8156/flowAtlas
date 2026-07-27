import { likeWlReducer } from "./storeReducer.js";

declare function configureStore(configuration: unknown): unknown;

const store = configureStore({
  reducer: {
    lState: likeWlReducer,
  },
});

void store;
