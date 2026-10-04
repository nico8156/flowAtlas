import * as community from "./events.js";

declare function createListenerMiddleware(): { startListening: unknown };
declare type TypedStartListening = (configuration: {
  actionCreator: unknown;
  effect: (action: unknown, api: { dispatch(action: unknown): void }) => void;
}) => unknown;

export function createCommunityListeners() {
  const mw = createListenerMiddleware();
  const listen = mw.startListening as TypedStartListening;
  listen({
    actionCreator: community.opened,
    effect: (_action, api) => {
      api.dispatch(community.changed());
      // @ts-expect-error An unresolved export must not produce a graph edge.
      api.dispatch(community.missing());
    },
  });
  listen({
    actionCreator: community.changed,
    effect: () => {},
  });
}
