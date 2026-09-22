package fixture.outbox;

import java.util.List;

public final class LocalDispatcher {
    private final List<LocalHandler> handlers;

    public LocalDispatcher(List<LocalHandler> handlers) {
        this.handlers = handlers;
    }

    public void dispatch(LocalMessage message) {
        for (LocalHandler handler : handlers) {
            if (handler.eventType().equals(message.eventType())) {
                handler.handle(message);
            }
        }
    }
}
