package fixture.shared;

public interface CommandHandler<C extends Command> {
    void execute(C command);
}
