interface LikeWlGateway {
  get(input: { targetId: string }): Promise<void>;
}

type Dependencies = {
  gateways: {
    likes: LikeWlGateway;
  };
};

type ExtraArgument = Dependencies["gateways"] | undefined;

type AppThunk<ReturnType> = (
  dispatch: (action: unknown) => void,
  getState: unknown,
  extraArgument: ExtraArgument,
) => ReturnType;

export const likesRetrieval =
  ({ targetId }: { targetId: string }): AppThunk<Promise<void>> =>
  async (_dispatch, _getState, gateways) => {
    if (!gateways) return;

    const likeGateway = gateways.likes;
    await likeGateway.get({ targetId });
  };
