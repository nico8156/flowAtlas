interface LikeWlGateway {
  add(): Promise<void>;
}

interface CommentGateway {
  create(): Promise<void>;
}

type OutboxCommand = { kind: "Like.Add" } | { kind: "Comment.Create" };
type Gateway = LikeWlGateway | CommentGateway;
type GatewayDeps = { likes: LikeWlGateway; comments: CommentGateway };
type TypedStartListening = (configuration: unknown) => unknown;

declare const gateways: GatewayDeps;
declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };

function getOutboxCommandGateway(deps: GatewayDeps, kind: OutboxCommand["kind"]): Gateway {
  return kind === "Like.Add" ? deps.likes : deps.comments;
}

async function sendOutboxCommand(input: {
  command: OutboxCommand;
  gateway: Gateway;
}): Promise<void> {
  if (input.command.kind === "Like.Add" && "add" in input.gateway) {
    await input.gateway.add();
  }
}

async function processOutbox(input: {
  command: OutboxCommand;
  gateways: GatewayDeps;
}): Promise<void> {
  const gateway = getOutboxCommandGateway(input.gateways, input.command.kind);
  await sendOutboxCommand({ command: input.command, gateway });
}

const requested = createAction("REQUESTED");

const processOutboxFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const command: OutboxCommand = { kind: "Like.Add" };
      await processOutbox({ command, gateways });
    },
  });

  return mw;
};

void processOutboxFactory;
