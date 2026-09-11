package fixture.projection;

import fixture.events.TicketVerifyAcceptedEvent;

public interface TicketProjectionRepository {
    boolean applyAnalyzing(TicketVerifyAcceptedEvent event);
}
