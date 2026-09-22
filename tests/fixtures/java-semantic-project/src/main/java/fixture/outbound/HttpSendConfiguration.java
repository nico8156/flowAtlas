package fixture.outbound;

import java.net.http.HttpClient;

public final class HttpSendConfiguration {
    public SendPort sender(HttpClient client) {
        return new HttpSendAdapter(client);
    }
}
