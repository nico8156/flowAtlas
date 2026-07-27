declare function createAction(type: string): () => unknown;

const likesRetrievalPending = createAction("LIKES/RETRIEVAL_PENDING");

export const likesRetrieval =
  ({ targetId }: { targetId: string }) =>
  async (dispatch: (action: unknown) => void) => {
    dispatch(likesRetrievalPending());
    void targetId;
  };
