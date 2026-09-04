import notificationsReducer from "./defaultExportReducer.js";

declare function configureStore(configuration: unknown): unknown;

configureStore({
  reducer: {
    notifications: notificationsReducer,
  },
});
