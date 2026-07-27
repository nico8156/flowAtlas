export const likesRetrieval =
  ({ targetId }: { targetId: string }) =>
  async (dispatch: (action: unknown) => void) => {
    dispatch({ type: "LIKES/RETRIEVAL_PENDING", targetId });
  };
