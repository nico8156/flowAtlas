interface LikeWlGateway {
  add(commandId: string): Promise<void>;
}

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const gateway: LikeWlGateway;

const getOutboxCommandGateway = (external: LikeWlGateway): LikeWlGateway => external;

const sendOutboxCommand = async (external: LikeWlGateway): Promise<void> => {
  await external.add("command-id");
};

const outboxProcessOnce = createAction("OUTBOX/PROCESS_ONCE");

const processOutboxFactory = () => {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;

  listen({
    actionCreator: outboxProcessOnce,
    effect: async () => {
      await sendOutboxCommand(getOutboxCommandGateway(gateway));
    },
  });

  return mw;
};

void processOutboxFactory;
