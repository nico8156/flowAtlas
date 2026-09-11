package fixture.projection;

public record ProjectionSyncEvent(String projection, String scope) {
    public static ProjectionSyncEvent projectionUpdated(String projection, String scope) {
        return new ProjectionSyncEvent(projection, scope);
    }
}
