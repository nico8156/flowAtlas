package fixture.integration;

public interface SqsIntegrationEventHandler {
    IntegrationEventRoute route();
    void handle(IntegrationEventEnvelope envelope);
}
