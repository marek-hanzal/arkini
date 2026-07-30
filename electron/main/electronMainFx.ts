import { app, BrowserWindow, nativeTheme } from "electron";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { createMainWindowFx } from "./createMainWindowFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { registerArkiniElectronIpcFx } from "./registerArkiniElectronIpcFx";
import { registerArkiniProtocolFx } from "./registerArkiniProtocolFx";
import { registerWindowLifecycleFx } from "./registerWindowLifecycleFx";
import { createFilesystemAppearancePreferencesFx } from "./appearance/createFilesystemAppearancePreferencesFx";
import { createFilesystemCheatPreferencesFx } from "./cheat/createFilesystemCheatPreferencesFx";
import { createFilesystemLauncherPreferencesFx } from "./launcher/createFilesystemLauncherPreferencesFx";
import { createTrustedRendererFx } from "./security/createTrustedRendererFx";
import { createDiagnosticLogFx } from "./diagnostics/createDiagnosticLogFx";
import { createFilesystemWindowPreferencesFx } from "./window/createFilesystemWindowPreferencesFx";
import { createArkiniUserDataPathsFx } from "./user-data/createArkiniUserDataPathsFx";
import { migrateArkiniUserDataFx } from "./user-data/migrateArkiniUserDataFx";

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

	const userDataPath = app.getPath("userData");
	const userDataPaths = yield* createArkiniUserDataPathsFx(userDataPath);
	yield* migrateArkiniUserDataFx({
		paths: userDataPaths,
	});

	const diagnostics = yield* createDiagnosticLogFx(userDataPaths.game.logs).pipe(
		Effect.catch((cause) =>
			Effect.sync(() => {
				console.error("Arkini diagnostic log could not be initialized.", cause);
				return {
					directoryPath: "",
					writeFx: () => Effect.void,
					openDirectoryFx: Effect.void,
					closeFx: Effect.void,
				};
			}),
		),
	);
	yield* diagnostics
		.writeFx({
			schemaVersion: 1,
			category: [
				"main",
				"lifecycle",
			],
			event: "application-started",
			level: "info",
			data: {
				version: app.getVersion(),
				isPackaged: app.isPackaged,
				platform: process.platform,
				architecture: process.arch,
			},
		})
		.pipe(Effect.catch((cause) => Effect.sync(() => console.error(cause))));
	yield* Effect.sync(() => {
		app.once("will-quit", () => {
			void ElectronMainRuntime.runPromise(
				diagnostics
					.writeFx({
						schemaVersion: 1,
						category: [
							"main",
							"lifecycle",
						],
						event: "application-stopping",
						level: "info",
					})
					.pipe(Effect.andThen(diagnostics.closeFx)),
			).catch((cause) => {
				console.error("Arkini diagnostic log could not be closed.", cause);
			});
		});
	});
	const appearancePreferences = yield* createFilesystemAppearancePreferencesFx({
		root: userDataPaths.game.preferences,
	});
	const cheatPreferences = yield* createFilesystemCheatPreferencesFx({
		root: userDataPaths.game.preferences,
	});
	const launcherPreferences = yield* createFilesystemLauncherPreferencesFx({
		root: userDataPaths.game.preferences,
	});
	const windowPreferences = yield* createFilesystemWindowPreferencesFx({
		root: userDataPaths.game.preferences,
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
	yield* registerArkiniElectronIpcFx({
		trustedRenderer,
		appearancePreferences,
		cheatPreferences,
		launcherPreferences,
		windowPreferences,
		diagnostics,
		userDataPaths,
	});
	const createWindowFx = windowPreferences.readModeFx.pipe(
		Effect.flatMap((windowMode) =>
			createMainWindowFx({
				trustedRenderer,
				windowMode,
				windowPreferences,
			}),
		),
	);
	yield* createWindowFx;

	yield* Effect.sync(() => {
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				void ElectronMainRuntime.runPromise(createWindowFx).catch((error) => {
					console.error("Arkini could not create a replacement window.", error);
				});
			}
		});
	});
});
