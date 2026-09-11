package fixture.commands;

import fixture.shared.Command;

public record VerifyTicketCommand(String ticketId) implements Command {
}
