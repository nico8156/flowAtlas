package fixture.integration;

public final class OutboxEvent {
    private final String aggregateType;
    private final String eventType;

    public OutboxEvent(String aggregateType, String eventType) {
        this.aggregateType = aggregateType;
        this.eventType = eventType;
    }

    public String getAggregateType() {
        return aggregateType;
    }

    public String getEventType() {
        return eventType;
    }
}
