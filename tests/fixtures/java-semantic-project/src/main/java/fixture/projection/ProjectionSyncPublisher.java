package fixture.projection;

public interface ProjectionSyncPublisher {
    void publish(ProjectionSyncEvent event);
}
