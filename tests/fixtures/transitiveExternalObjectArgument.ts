interface LikeGateway {
  add(): Promise<void>;
}

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const gateway: LikeGateway;

function getGateway(): LikeGateway {
  return gateway;
}

async function sendCommand(deps: { gateway: LikeGateway }): Promise<void> {
  await deps.gateway.add();
}

const requested = createAction("REQUESTED");

const handlerFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const gateway = getGateway();

      await sendCommand({
        gateway,
      });
    },
  });

  return mw;
};

void handlerFactory;
