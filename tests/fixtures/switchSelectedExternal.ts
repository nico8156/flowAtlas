interface LikeWlGateway {
  add(): Promise<void>;
}

interface CommentsGateway {
  create(): Promise<void>;
}

type Command = { kind: "Like.Add" } | { kind: "Comment.Create" };

type Gateways = {
  likes: LikeWlGateway;
  comments: CommentsGateway;
};

type Dependencies = {
  gateways: Gateways;
};

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const command: Command;

function getGateway(gateways: Gateways, kind: Command["kind"]) {
  switch (kind) {
    case "Like.Add":
      return gateways.likes;
    case "Comment.Create":
      return gateways.comments;
  }
}

async function sendCommand(input: { gateway: ReturnType<typeof getGateway> }): Promise<void> {
  if (input.gateway && "add" in input.gateway) {
    await input.gateway.add();
  } else if (input.gateway) {
    await input.gateway.create();
  }
}

const requested = createAction("REQUESTED");

const handlerFactory = (deps: Dependencies) => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const gateway = getGateway(deps.gateways, command.kind);
      await sendCommand({ gateway });
    },
  });

  return mw;
};

void handlerFactory;
