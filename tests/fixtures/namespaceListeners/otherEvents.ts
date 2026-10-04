declare function createAction(type: string): () => unknown;

export const opened = createAction("other/opened");
export const changed = createAction("other/changed");
