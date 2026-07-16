import type { App } from "electron";

export function registerWindowLifecycle(app: Pick<App, "on" | "quit">): void {
	app.on("window-all-closed", () => {
		app.quit();
	});
}
