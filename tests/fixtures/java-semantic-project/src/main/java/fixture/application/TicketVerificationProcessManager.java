package fixture.application;

import fixture.events.TicketVerificationCompletedEvent;
import fixture.events.TicketVerifyAcceptedEvent;
import fixture.ports.TicketVerificationProvider;
import fixture.shared.DomainEventPublisher;
import fixture.shared.EventHandler;

public final class TicketVerificationProcessManager implements EventHandler<TicketVerifyAcceptedEvent> {
    private final TicketVerificationProvider provider;
    private final DomainEventPublisher eventPublisher;

    public TicketVerificationProcessManager(
            TicketVerificationProvider provider,
            DomainEventPublisher eventPublisher) {
        this.provider = provider;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public void handle(TicketVerifyAcceptedEvent event) {
        String outcome = provider.verify(event.ocrText(), event.imageRef());
        TicketVerificationCompletedEvent completed = new TicketVerificationCompletedEvent(outcome);
        eventPublisher.publish(completed);
    }
}
