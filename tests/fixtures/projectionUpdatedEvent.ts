type ProjectionSyncEvent = {
  eventName: string;
};

const handleProjectionEvent = (event: ProjectionSyncEvent): void => {
  if (event.eventName !== "projection.updated") return;
};

void handleProjectionEvent;
