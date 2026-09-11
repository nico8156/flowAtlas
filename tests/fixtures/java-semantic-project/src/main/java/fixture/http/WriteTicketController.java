package fixture.http;

import fixture.commands.VerifyTicketCommand;
import fixture.infrastructure.CommandBus;

@RequestMapping("/api/tickets")
public final class WriteTicketController {
    private final CommandBus commandBus;

    public WriteTicketController(CommandBus commandBus) {
        this.commandBus = commandBus;
    }

    @PostMapping("/verify")
    public void verify() {
        VerifyTicketCommand command = new VerifyTicketCommand("ticket-1");
        commandBus.dispatch(command);
    }
}
