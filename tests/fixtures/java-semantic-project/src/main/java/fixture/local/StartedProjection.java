package fixture.local;

public final class StartedProjection {
    private final SaveCurrentViewPort saveView;

    public StartedProjection(SaveCurrentViewPort saveView) {
        this.saveView = saveView;
    }

    public void handle(Started event) {
        saveView.upsert(new CurrentView(event.id()));
    }
}
