package fixture.shared;

public interface DomainEventPublisher {
    void publish(DomainEvent event);
}
