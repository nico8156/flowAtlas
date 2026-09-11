package fixture.integration;

public final class InboxMessageRepository {
    public boolean claim(IntegrationEventEnvelope envelope) {
        return true;
    }
}
