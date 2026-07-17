import type { App } from "electron";
import { Effect } from "effect";

export const registerWindowLifecycleFx = Effect.fn("registerWindowLifecycleFx")(
	(app: Pick<App, "on" | "quit">) =>
		Effect.sync(() => {
			app.on("window-all-closed", () => {
				app.quit();
			});
		}),
);
