package fixture.shared;

public interface EventHandler<E extends DomainEvent> {
    void handle(E event);
}
