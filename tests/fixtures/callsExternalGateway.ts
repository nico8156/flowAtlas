interface LikeWlGateway {
  add(commandId: string): Promise<void>;
}

declare const gateway: LikeWlGateway;
declare function startListening(configuration: unknown): unknown;

const submitListener = startListening({
  effect: async () => {
    await gateway.add("command-id");
  },
});

void submitListener;
