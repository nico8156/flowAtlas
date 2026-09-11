package fixture.integration;

public record IntegrationEventEnvelope(String destination, String eventType, int version) {}
