package fixture.application;

public final class BrokenHandler {
    private final missing.Dependency dependency;

    public BrokenHandler(missing.Dependency dependency) {
        this.dependency = dependency;
    }
}
