interface LikeWlGateway {
  get(input: { targetId: string }): Promise<void>;
}

type Dependencies = {
  likes: LikeWlGateway;
};

export const likesRetrieval =
  ({ targetId }: { targetId: string }) =>
  async (_dispatch: (action: unknown) => void, _getState: unknown, gateways: Dependencies) => {
    const likeGateway = gateways.likes;
    await likeGateway.get({ targetId });
  };
