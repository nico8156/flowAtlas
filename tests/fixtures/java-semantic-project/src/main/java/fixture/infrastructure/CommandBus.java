package fixture.infrastructure;

import fixture.shared.Command;

public interface CommandBus {
    void dispatch(Command command);
}
