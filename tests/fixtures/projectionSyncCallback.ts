type ProjectionSyncEvent = {
  eventName: string;
};

type ProjectionSyncGateway = {
  connect(input: { onEvent: (event: ProjectionSyncEvent) => void }): void;
};

declare const gateway: ProjectionSyncGateway;

const projectionSyncListenerFactory = () => {
  gateway.connect({
    onEvent: (event) => {
      if (event.eventName !== "projection.updated") return;
    },
  });
};

void projectionSyncListenerFactory;
