interface LikeGateway {
  send(): Promise<void>;
}

interface CommentGateway {
  send(): Promise<void>;
}

type Gateway = LikeGateway | CommentGateway;

declare const likeGateway: LikeGateway;
declare const commentGateway: CommentGateway;
declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };

function getGateway(commandType: string): Gateway {
  return commandType === "like" ? likeGateway : commentGateway;
}

async function sendCommand(deps: { gateway: Gateway }): Promise<void> {
  await deps.gateway.send();
}

const requested = createAction("REQUESTED");

const handlerFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as (configuration: unknown) => unknown;

  listen({
    actionCreator: requested,
    effect: async (command: { type: string }) => {
      const gateway = getGateway(command.type);
      await sendCommand({ gateway });
    },
  });

  return mw;
};

void handlerFactory;
