package fixture.integration;

public record OutboxEventMetadata(String aggregateType, String aggregateId, String streamKey) {}
