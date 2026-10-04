declare function createAction(type: string): () => unknown;

export const opened = createAction("community/opened");
export const changed = createAction("community/changed");
