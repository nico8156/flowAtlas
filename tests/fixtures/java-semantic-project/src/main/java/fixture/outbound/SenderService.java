package fixture.outbound;

import java.net.http.HttpRequest;

public final class SenderService {
    private final SendPort sender;

    public SenderService(SendPort sender) {
        this.sender = sender;
    }

    public void deliver(HttpRequest request) throws Exception {
        sender.send(request);
    }
}
