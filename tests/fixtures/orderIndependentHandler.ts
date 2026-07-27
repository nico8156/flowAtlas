import { dispatchedEvent } from "./orderIndependentEvent.js";

declare function startListening(configuration: unknown): unknown;

const submitListener = startListening({
  effect: async (_: unknown, api: { dispatch(action: unknown): void }) => {
    api.dispatch(dispatchedEvent());
  },
});

void submitListener;
