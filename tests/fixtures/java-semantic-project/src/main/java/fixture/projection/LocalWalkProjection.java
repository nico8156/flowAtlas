package fixture.projection;

import fixture.events.TicketVerifyAcceptedEvent;

public final class LocalWalkProjection {
    private final LocalWalkViewPort view;

    public LocalWalkProjection(LocalWalkViewPort view) {
        this.view = view;
    }

    public void handle(TicketVerifyAcceptedEvent event) {
        view.save(event);
    }
}
