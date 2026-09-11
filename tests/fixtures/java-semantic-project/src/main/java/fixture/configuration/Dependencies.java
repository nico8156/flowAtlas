package fixture.configuration;

import fixture.adapters.ProcessVerificationProvider;
import fixture.ports.TicketVerificationProvider;

public final class Dependencies {
    public TicketVerificationProvider verificationProvider() {
        return new ProcessVerificationProvider();
    }
}
