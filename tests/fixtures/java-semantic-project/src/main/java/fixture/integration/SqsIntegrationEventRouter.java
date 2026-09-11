package fixture.integration;

import java.util.List;

public final class SqsIntegrationEventRouter {
    private final InboxMessageRepository inbox;
    private final List<SqsIntegrationEventHandler> handlers;

    public SqsIntegrationEventRouter(
            InboxMessageRepository inbox,
            List<SqsIntegrationEventHandler> handlers) {
        this.inbox = inbox;
        this.handlers = handlers;
    }

    public void route(IntegrationEventEnvelope envelope) {
        if (!inbox.claim(envelope)) return;
        dispatch(envelope);
    }

    private void dispatch(IntegrationEventEnvelope envelope) {
        for (SqsIntegrationEventHandler handler : handlers) {
            handler.handle(envelope);
        }
    }
}
