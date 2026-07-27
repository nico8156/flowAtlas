declare type ActionCreator = () => unknown;
declare type ListenerApi = { dispatch: (action: unknown) => unknown };
declare function createAction(type: string): ActionCreator;
declare function createListenerMiddleware(): { startListening: unknown };
declare type TypedStartListening<State, Dispatch> = (configuration: {
  actionCreator: unknown;
  effect: (state: State, dispatch: Dispatch) => Promise<void>;
}) => unknown;

const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");
const likeOptimisticApplied = createAction("LIKE/OPTIMISTIC_APPLIED");

const likeToggleUseCaseFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening<unknown, ListenerApi>;

  listen({
    actionCreator: uiLikeToggleRequested,
    effect: async (_state, api) => {
      api.dispatch(likeOptimisticApplied());
    },
  });

  return mw;
};

void likeToggleUseCaseFactory;
