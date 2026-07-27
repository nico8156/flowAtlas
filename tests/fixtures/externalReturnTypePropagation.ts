interface LikeWlGateway {
  add(): Promise<void>;
}

type Dependencies = {
  likes: LikeWlGateway;
};

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };

function getGateway(deps: Dependencies): LikeWlGateway {
  return deps.likes;
}

async function sendCommand(input: { gateway: ReturnType<typeof getGateway> }): Promise<void> {
  await input.gateway.add();
}

const requested = createAction("REQUESTED");

const handlerFactory = (deps: Dependencies) => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const gateway = getGateway(deps);

      await sendCommand({ gateway });
    },
  });

  return mw;
};

void handlerFactory;
