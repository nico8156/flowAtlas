interface LikeWlGateway {
  add(): Promise<void>;
}

interface CommentsGateway {
  create(): Promise<void>;
}

type OutboxCommand = { kind: "Like.Add" } | { kind: "Comment.Create" };

type Gateways = {
  likes: LikeWlGateway;
  comments: CommentsGateway;
};

type Dependencies = {
  gateways: Gateways;
};

const hasAdd = (gateway: object): gateway is LikeWlGateway => "add" in gateway;
const hasCreate = (gateway: object): gateway is CommentsGateway => "create" in gateway;

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const queuedCommand: OutboxCommand;

function getGateway(gateways: Gateways, kind: OutboxCommand["kind"]) {
  switch (kind) {
    case "Like.Add":
      return gateways.likes;
    case "Comment.Create":
      return gateways.comments;
  }
}

async function sendCommand(input: { command: OutboxCommand; gateway: object }): Promise<void> {
  switch (input.command.kind) {
    case "Like.Add":
      if (hasAdd(input.gateway)) await input.gateway.add();
      return;
    case "Comment.Create":
      if (hasCreate(input.gateway)) await input.gateway.create();
      return;
  }
}

const requested = createAction("REQUESTED");

const processOutboxFactory = (deps: Dependencies) => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const gateway = getGateway(deps.gateways, queuedCommand.kind);
      await sendCommand({ command: queuedCommand, gateway: gateway });
    },
  });

  return mw;
};

void processOutboxFactory;
