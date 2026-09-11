package fixture.adapters;

import fixture.ports.TicketVerificationProvider;

public final class ProcessVerificationProvider implements TicketVerificationProvider {
    @Override
    public String verify(String ocrText, String imageRef) {
        try {
            new ProcessBuilder("ticketverify").start();
            return "ok";
        } catch (java.io.IOException exception) {
            return "failed";
        }
    }
}
