interface LikeWlGateway {
  add(): Promise<void>;
}

interface CommentsGateway {
  create(): Promise<void>;
}

type Gateways = {
  likes: LikeWlGateway;
  comments: CommentsGateway;
};

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const gateways: Gateways;

function getFunctionGateway(source: Gateways): LikeWlGateway {
  return source.likes;
}

const getArrowGateway = (source: Gateways): CommentsGateway => source.comments;

async function sendLike(input: { gateway: ReturnType<typeof getFunctionGateway> }) {
  await input.gateway.add();
}

async function sendComment(input: { gateway: ReturnType<typeof getArrowGateway> }) {
  await input.gateway.create();
}

const requested = createAction("REQUESTED");

const handlerFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: requested,
    effect: async () => {
      const likeGateway = getFunctionGateway(gateways);
      await sendLike({ gateway: likeGateway });

      const commentGateway = getArrowGateway(gateways);
      await sendComment({ gateway: commentGateway });
    },
  });

  return mw;
};

void handlerFactory;
