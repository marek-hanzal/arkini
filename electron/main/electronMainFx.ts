import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { createMainWindowFx } from "./createMainWindowFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { registerArkiniDesktopIpcFx } from "./registerArkiniDesktopIpcFx";
import { registerArkiniProtocolFx } from "./registerArkiniProtocolFx";
import { registerWindowLifecycleFx } from "./registerWindowLifecycleFx";

export const electronMainFx = Effect.fn("electronMainFx")(function* () {
	const hasSingleInstanceLock = app.requestSingleInstanceLock();
	if (!hasSingleInstanceLock) {
		app.quit();
		return;
	}

	yield* Effect.sync(() => {
		app.on("second-instance", () => {
			const window = BrowserWindow.getAllWindows()[0];
			if (!window) return;
			if (window.isMinimized()) window.restore();
			window.focus();
		});
	});
	yield* registerWindowLifecycleFx(app);
	yield* Effect.promise(() => app.whenReady());

	const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
	yield* registerArkiniProtocolFx(rendererRoot);
	yield* registerArkiniDesktopIpcFx();
	yield* createMainWindowFx();

	yield* Effect.sync(() => {
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				void ElectronMainRuntime.runPromise(createMainWindowFx()).catch((error) => {
					console.error("Arkini could not create a replacement window.", error);
				});
			}
		});
	});
});
