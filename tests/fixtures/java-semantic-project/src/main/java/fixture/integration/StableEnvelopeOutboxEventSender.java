package fixture.integration;

import java.util.List;

public final class StableEnvelopeOutboxEventSender {
    private final List<IntegrationMessagePublisher> publishers;
    private final IntegrationEventDestinationResolver destinationResolver;
    private final IntegrationEventEnvelopeFactory envelopeFactory;

    public StableEnvelopeOutboxEventSender(List<IntegrationMessagePublisher> publishers) {
        this.publishers = publishers;
        this.destinationResolver = new IntegrationEventDestinationResolver();
        this.envelopeFactory = new IntegrationEventEnvelopeFactory();
    }

    public void send(OutboxEvent event) {
        for (String destination : destinationResolver.destinationsFor(event)) {
            var envelope = envelopeFactory.from(event, destination);
            for (IntegrationMessagePublisher publisher : publishers) {
                publisher.publish(envelope);
            }
        }
    }
}
