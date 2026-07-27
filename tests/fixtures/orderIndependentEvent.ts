declare function createAction(type: string): () => unknown;

export const dispatchedEvent = createAction("DISPATCHED_EVENT");
