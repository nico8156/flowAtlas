declare function createAction(type: string): unknown;

const uiLikeToggleRequested = createAction("UI/LIKE/TOGGLE_REQUESTED");

void uiLikeToggleRequested;
