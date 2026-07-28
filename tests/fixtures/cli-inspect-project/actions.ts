declare function createAction(type: string): unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare type TypedStartListening = (configuration: {
  actionCreator: unknown;
  effect: () => Promise<void>;
}) => unknown;

const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");

const likeToggleUseCaseFactory = () => {
  const middleware = createListenerMiddleware();
  const listen = middleware.startListening as TypedStartListening;

  listen({
    actionCreator: uiLikeToggleRequested,
    effect: async () => {},
  });

  return middleware;
};

void likeToggleUseCaseFactory;
