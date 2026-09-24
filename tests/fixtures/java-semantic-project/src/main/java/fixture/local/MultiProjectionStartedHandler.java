package fixture.local;

public final class MultiProjectionStartedHandler {
    private final SaveCurrentViewPort saveView;
    private final ReplaceCurrentProgressPort replaceProgress;

    public MultiProjectionStartedHandler(
            SaveCurrentViewPort saveView,
            ReplaceCurrentProgressPort replaceProgress) {
        this.saveView = saveView;
        this.replaceProgress = replaceProgress;
    }

    public void handle(Started event) {
        saveView.upsert(new CurrentView(event.id()));
        replaceProgress.replace(new CurrentProgress(event.id().length()));
    }
}
