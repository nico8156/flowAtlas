package fixture.integration;

public interface IntegrationMessagePublisher {
    void publish(IntegrationEventEnvelope envelope);
}
