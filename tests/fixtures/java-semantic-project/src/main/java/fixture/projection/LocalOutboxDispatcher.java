package fixture.projection;

import fixture.events.TicketVerifyAcceptedEvent;

public final class LocalOutboxDispatcher {
    private final LocalWalkProjection projection;

    public LocalOutboxDispatcher(LocalWalkProjection projection) {
        this.projection = projection;
    }

    public void dispatch(TicketVerifyAcceptedEvent event) {
        projection.handle(event);
    }
}
