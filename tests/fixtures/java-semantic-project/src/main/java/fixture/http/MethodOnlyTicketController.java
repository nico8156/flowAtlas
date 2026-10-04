package fixture.http;

import fixture.commands.VerifyTicketCommand;
import fixture.infrastructure.CommandBus;

public final class MethodOnlyTicketController {
    private final CommandBus commandBus;

    public MethodOnlyTicketController(CommandBus commandBus) {
        this.commandBus = commandBus;
    }

    @PostMapping("/api/tickets/verify")
    public void verify() {
        commandBus.dispatch(new VerifyTicketCommand("ticket-1"));
    }

    public void unmapped() {
        commandBus.dispatch(new VerifyTicketCommand("ticket-1"));
    }
}
