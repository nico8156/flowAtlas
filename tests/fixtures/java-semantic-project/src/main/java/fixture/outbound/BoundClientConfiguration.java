package fixture.outbound;

public final class BoundClientConfiguration {
    public SendPort sender(RemoteClient client) {
        return new BoundClientAdapter(client);
    }
}
