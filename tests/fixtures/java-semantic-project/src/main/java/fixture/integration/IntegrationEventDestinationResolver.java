package fixture.integration;

import static fixture.integration.IntegrationEventDestinations.TICKET_EVENTS;
import static fixture.integration.IntegrationEventDestinations.TICKET_VERIFICATION_REQUESTED;

import java.util.List;

public final class IntegrationEventDestinationResolver {
    public List<String> destinationsFor(OutboxEvent event) {
        String aggregateType = event.getAggregateType();
        String eventType = event.getEventType();
        if ("Ticket".equals(aggregateType)) {
            if (eventType.endsWith("TicketVerifyAcceptedEvent")) {
                return List.of(TICKET_EVENTS, TICKET_VERIFICATION_REQUESTED);
            }
            return List.of(TICKET_EVENTS);
        }
        return List.of();
    }
}
