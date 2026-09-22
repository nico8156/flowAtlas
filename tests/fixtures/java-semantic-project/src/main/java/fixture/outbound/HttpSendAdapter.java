package fixture.outbound;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public final class HttpSendAdapter implements SendPort {
    private final HttpClient client;

    public HttpSendAdapter(HttpClient client) {
        this.client = client;
    }

    @Override
    public void send(HttpRequest request) throws Exception {
        client.send(request, HttpResponse.BodyHandlers.discarding());
    }
}
