package fixture.integration;

import fixture.events.TicketVerifyAcceptedEvent;
import fixture.shared.DomainEvent;
import java.util.Optional;

public final class TicketOutboxEventMetadataContributor {
    public Optional<OutboxEventMetadata> resolve(DomainEvent event) {
        if (event instanceof TicketVerifyAcceptedEvent accepted) {
            return Optional.of(new OutboxEventMetadata("Ticket", accepted.toString(), "ticket"));
        }
        return Optional.empty();
    }
}
