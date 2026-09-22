package fixture.projection;

import fixture.events.TicketVerifyAcceptedEvent;

public interface LocalWalkViewPort {
    void save(TicketVerifyAcceptedEvent event);
}
