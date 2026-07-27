declare function createAction(type: string): () => unknown;

declare function missingEvent(): unknown;

declare function startListening(configuration: unknown): unknown;

const knownEvent = createAction("KNOWN_EVENT");

const submitListener = startListening({
  actionCreator: knownEvent,
  effect: async (_: unknown, api: { dispatch(action: unknown): void }) => {
    api.dispatch(knownEvent());
    api.dispatch(missingEvent());
  },
});

void submitListener;
