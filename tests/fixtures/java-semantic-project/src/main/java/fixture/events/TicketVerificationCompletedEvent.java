package fixture.events;

import fixture.shared.DomainEvent;

public record TicketVerificationCompletedEvent(String outcome) implements DomainEvent {
}
