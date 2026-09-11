package fixture.projection;

import fixture.events.TicketVerifyAcceptedEvent;

public final class TicketVerifyAcceptedProjection {
    private final TicketProjectionRepository repository;
    private final ProjectionSyncPublisher syncPublisher;

    public TicketVerifyAcceptedProjection(
            TicketProjectionRepository repository,
            ProjectionSyncPublisher syncPublisher) {
        this.repository = repository;
        this.syncPublisher = syncPublisher;
    }

    public void handle(TicketVerifyAcceptedEvent event) {
        if (!repository.applyAnalyzing(event)) return;
        syncPublisher.publish(ProjectionSyncEvent.projectionUpdated("tickets", "entity"));
    }
}
