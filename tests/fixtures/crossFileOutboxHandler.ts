import {
  getGateway,
  sendCommand,
  type Gateways,
  type OutboxCommand,
} from "./crossFileOutboxRouting.js";

type Dependencies = {
  gateways: Gateways;
};

type TypedStartListening = (configuration: unknown) => unknown;

declare function createAction(type: string): () => unknown;
declare function createListenerMiddleware(): { startListening: unknown };
declare const queuedCommand: OutboxCommand;

const requested = createAction("REQUESTED");

export const processOutboxFactory = (deps: Dependencies) => {
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
