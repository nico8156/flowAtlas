package fixture.integration;

import static fixture.integration.IntegrationEventDestinations.TICKET_EVENTS;
import static fixture.integration.IntegrationEventDestinations.TICKET_VERIFICATION_REQUESTED;

import fixture.application.TicketVerificationProcessManager;
import java.util.function.Consumer;

public final class TicketSqsIntegrationEventHandlers {
    public SqsIntegrationEventHandler ticketReadHandler(TicketReadHandler handler) {
        return new SimpleHandler(TICKET_EVENTS, "ticket.verify.accepted", envelope -> handler.toString());
    }

    public SqsIntegrationEventHandler verificationHandler(TicketVerificationProcessManager handler) {
        return new SimpleHandler(
                TICKET_VERIFICATION_REQUESTED,
                "ticket.verify.accepted",
                envelope -> handler.toString());
    }

    private record SimpleHandler(
            String destination,
            String eventType,
            Consumer<IntegrationEventEnvelope> handler) implements SqsIntegrationEventHandler {
        @Override
        public IntegrationEventRoute route() {
            return new IntegrationEventRoute(destination, eventType);
        }

        @Override
        public void handle(IntegrationEventEnvelope envelope) {
            handler.accept(envelope);
        }
    }
}
