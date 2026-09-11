package fixture.events;

import fixture.shared.DomainEvent;

public record TicketVerifyAcceptedEvent(String ocrText, String imageRef) implements DomainEvent {
}
