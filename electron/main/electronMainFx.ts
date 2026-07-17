import { app, BrowserWindow, nativeTheme } from "electron";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { createMainWindowFx } from "./createMainWindowFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { registerArkiniDesktopIpcFx } from "./registerArkiniDesktopIpcFx";
import { registerArkiniProtocolFx } from "./registerArkiniProtocolFx";
import { registerWindowLifecycleFx } from "./registerWindowLifecycleFx";
import { createFilesystemAppearancePreferencesFx } from "./appearance/createFilesystemAppearancePreferencesFx";
import { createTrustedRendererFx } from "./security/createTrustedRendererFx";

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

	const appearancePreferences = yield* createFilesystemAppearancePreferencesFx({
		userDataPath: app.getPath("userData"),
	});
	const appearanceTheme = yield* appearancePreferences.readThemeFx;
	yield* Effect.sync(() => {
		nativeTheme.themeSource = appearanceTheme;
	});

	const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
	const trustedRenderer = yield* createTrustedRendererFx({
		isPackaged: app.isPackaged,
		developmentRendererUrl: process.env.ELECTRON_RENDERER_URL,
	});
	yield* registerArkiniProtocolFx(rendererRoot);
	yield* registerArkiniDesktopIpcFx({
		trustedRenderer,
		appearancePreferences,
	});
	yield* createMainWindowFx({
		trustedRenderer,
	});

	yield* Effect.sync(() => {
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				void ElectronMainRuntime.runPromise(
					createMainWindowFx({
						trustedRenderer,
					}),
				).catch((error) => {
					console.error("Arkini could not create a replacement window.", error);
				});
			}
		});
	});
});
