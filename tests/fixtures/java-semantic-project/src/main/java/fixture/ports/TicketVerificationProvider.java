package fixture.ports;

public interface TicketVerificationProvider {
    String verify(String ocrText, String imageRef);
}
