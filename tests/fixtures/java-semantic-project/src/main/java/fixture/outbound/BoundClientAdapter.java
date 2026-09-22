package fixture.outbound;

import java.net.http.HttpRequest;
import java.util.Objects;

public final class BoundClientAdapter implements SendPort {
    private final Runnable transmit;

    public BoundClientAdapter(RemoteClient client) {
        this(client::transmit);
    }

    private BoundClientAdapter(Runnable transmit) {
        this.transmit = Objects.requireNonNull(transmit);
    }

    @Override
    public void send(HttpRequest request) {
        transmit.run();
    }
}
