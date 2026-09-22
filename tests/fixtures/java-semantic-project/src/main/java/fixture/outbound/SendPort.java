package fixture.outbound;

import java.net.http.HttpRequest;

public interface SendPort {
    void send(HttpRequest request) throws Exception;
}
