package fixture.integration;

import java.util.Map;

public final class IntegrationEventTypeCatalog {
    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("TicketVerifyAcceptedEvent", "ticket.verify.accepted"));

    private IntegrationEventTypeCatalog() {}

    public static int currentVersion(String eventType) {
        return 1;
    }
}
