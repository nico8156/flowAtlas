package fixture.application;

import fixture.events.TicketVerificationCompletedEvent;
import fixture.events.TicketVerifyAcceptedEvent;
import fixture.ports.TicketVerificationProvider;
import fixture.shared.EventHandler;

public final class TicketVerificationProcessManager implements EventHandler<TicketVerifyAcceptedEvent> {
    private final TicketVerificationProvider provider;

    public TicketVerificationProcessManager(TicketVerificationProvider provider) {
        this.provider = provider;
    }

    @Override
    public void handle(TicketVerifyAcceptedEvent event) {
        String outcome = provider.verify(event.ocrText(), event.imageRef());
        new TicketVerificationCompletedEvent(outcome);
    }
}
