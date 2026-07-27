interface LikeWlGateway {
  add(commandId: string): Promise<void>;
}

const processOutbox = (gateway: LikeWlGateway) => {
  void gateway;
};

void processOutbox;
