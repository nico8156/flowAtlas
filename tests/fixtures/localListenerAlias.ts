declare function createAction(type: string): unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare type TypedStartListening<State, Dispatch> = (configuration: {
  actionCreator: unknown;
  effect: (state: State, dispatch: Dispatch) => Promise<void>;
}) => unknown;

const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");

const likeToggleUseCaseFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening<unknown, unknown>;

  listen({
    actionCreator: uiLikeToggleRequested,
    effect: async () => {},
  });

  return mw;
};

void likeToggleUseCaseFactory;
