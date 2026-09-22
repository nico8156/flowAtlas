package fixture.outbox;

public final class RequestedHandler implements LocalHandler {
    @Override
    public String eventType() {
        return "Requested";
    }

    @Override
    public void handle(LocalMessage message) {
        if (!eventType().equals(message.eventType())) {
            throw new IllegalArgumentException("Wrong event type");
        }
    }
}
