interface LikeGateway {
  add(): Promise<void>;
}

interface CommentGateway {
  create(): Promise<void>;
}

type Command = { kind: "Like.Add" } | { kind: "Comment.Create" };
type Gateway = LikeGateway | CommentGateway;
type TypedStartListening = (configuration: unknown) => unknown;

declare const gateways: { likes: LikeGateway; comments: CommentGateway };
declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };

function getOutboxCommandGateway(kind: Command["kind"]): Gateway {
  return kind === "Like.Add" ? gateways.likes : gateways.comments;
}

async function sendOutboxCommand(deps: { command: Command; gateway: Gateway }): Promise<void> {
  if (deps.command.kind === "Like.Add" && "add" in deps.gateway) {
    await deps.gateway.add();
  }
}

const requested = createAction("REQUESTED");

const processOutboxFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const command: Command = { kind: "Like.Add" };
      const gateway = getOutboxCommandGateway(command.kind);
      await sendOutboxCommand({ command, gateway });
    },
  });

  return mw;
};

void processOutboxFactory;
