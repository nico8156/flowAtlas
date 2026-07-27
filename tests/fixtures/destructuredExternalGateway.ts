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

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const command: Command;
declare const gateways: Gateways;

const hasAdd = (gateway: object): gateway is LikeWlGateway => "add" in gateway;
const hasCreate = (gateway: object): gateway is CommentsGateway => "create" in gateway;

function getGateway(source: Gateways, kind: Command["kind"]) {
  switch (kind) {
    case "Like.Add":
      return source.likes;
    case "Comment.Create":
      return source.comments;
  }
}

async function sendCommand({
  command: inputCommand,
  gateway,
}: {
  command: Command;
  gateway: object;
}): Promise<void> {
  if (inputCommand.kind === "Like.Add" && hasAdd(gateway)) {
    await gateway.add();
  } else if (hasCreate(gateway)) {
    await gateway.create();
  }
}

const requested = createAction("REQUESTED");

const handlerFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const gateway = getGateway(gateways, command.kind);
      await sendCommand({ command, gateway: gateway });
    },
  });

  return mw;
};

void handlerFactory;
