package fixture.outbox;

public interface LocalHandler {
    String eventType();

    void handle(LocalMessage message);
}
