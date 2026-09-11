package fixture.integration;

public final class IntegrationEventEnvelopeFactory {
    public IntegrationEventEnvelope from(OutboxEvent event, String destination) {
        return new IntegrationEventEnvelope(destination, event.getEventType(), 1);
    }
}
