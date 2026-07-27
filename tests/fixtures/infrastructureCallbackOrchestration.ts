type ProjectionEvent = {
  eventName: string;
};

declare const gateway: {
  connect(configuration: { onEvent: (event: ProjectionEvent) => void }): void;
};

function routeProjectionUpdated(event: ProjectionEvent): void {
  if (event.eventName !== "projection.updated") return;
}

export function projectionSyncListenerFactory(): void {
  gateway.connect({
    onEvent: (event) => routeProjectionUpdated(event),
  });
}
