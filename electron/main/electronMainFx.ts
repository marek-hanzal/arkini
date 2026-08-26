import { app, BrowserWindow, nativeTheme, safeStorage } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
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
import { createWindowModeControllerOwnershipFx } from "./window/createWindowModeControllerOwnershipFx";
import { createArkiniUserDataPathsFx } from "./user-data/createArkiniUserDataPathsFx";
import type { EditorProjectServiceOwnership } from "./editor-project/EditorProjectServiceOwnership";
import { registerEditorMcpPreferencesIpcFx } from "./editor-mcp/ipc/registerEditorMcpPreferencesIpcFx";
import { createEditorMcpOwnershipFx } from "./editor-mcp/http/createEditorMcpOwnershipFx";
import { registerEditorProjectIpcFx } from "./editor-project/ipc/registerEditorProjectIpcFx";
import { createFilesystemEditorProjectRepositoryFx } from "./editor-project/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { createFilesystemCliInstallationFx } from "./cli/createFilesystemCliInstallationFx";
import { registerCliInstallationIpcFx } from "./cli/registerCliInstallationIpcFx";
import { createChatGptViewControllerOwnershipFx } from "./chatgpt/createChatGptViewControllerOwnershipFx";
import { registerChatGptIpcFx } from "./chatgpt/registerChatGptIpcFx";
import { createFilesystemEditorMcpStorageFx } from "./editor-mcp/storage/createFilesystemEditorMcpStorageFx";
import { createNgrokEditorMcpTunnelFx } from "./editor-mcp/tunnel/createNgrokEditorMcpTunnelFx";

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
	const editorProjectServiceOwnership: EditorProjectServiceOwnership =
		yield* createFilesystemEditorProjectRepositoryFx({
			catalogPath: userDataPaths.editor.catalog,
			projectsRoot: userDataPaths.editor.projects,
		}).pipe(
			Effect.map((repository) => ({
				type: "ready" as const,
				repository,
			})),
			Effect.catch((cause) =>
				Effect.sync(() => {
					console.error("Arkini editor storage could not be initialized.", cause);
					return {
						type: "unavailable" as const,
						message: "The editor storage could not be initialized.",
					};
				}),
			),
		);
	if (editorProjectServiceOwnership.type === "ready") {
		yield* Effect.sync(() => {
			app.once("will-quit", () => {
				ElectronMainRuntime.runSync(editorProjectServiceOwnership.repository.closeFx);
			});
		});
	}

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
	const editorMcpStorage = yield* createFilesystemEditorMcpStorageFx({
		root: userDataPaths.editor.root,
		protectFx: (value) =>
			Effect.try({
				try: () => safeStorage.encryptString(value),
				catch: (cause) => cause,
			}),
		unprotectFx: (value) =>
			Effect.try({
				try: () => safeStorage.decryptString(Buffer.from(value)),
				catch: (cause) => cause,
			}),
	});
	const editorMcpTunnel = yield* createNgrokEditorMcpTunnelFx;
	const editorMcpOwnership = yield* createEditorMcpOwnershipFx({
		editor: editorProjectServiceOwnership,
		notifyOverviewChanged: (overview) => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isDestroyed()) continue;
				window.webContents.send(
					ArkiniElectronApi.channels.editorMcpOverviewChanged,
					overview,
				);
			}
		},
		notifyProjectChanged: (projectId) => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isDestroyed()) continue;
				window.webContents.send(ArkiniElectronApi.channels.editorProjectChanged, projectId);
			}
		},
		storage: editorMcpStorage,
		runPromise: ElectronMainRuntime.runPromise,
		tunnel: editorMcpTunnel,
	});
	yield* Effect.sync(() => app.once("will-quit", editorMcpOwnership.closeSync));
	const windowModeControllerOwnership = yield* createWindowModeControllerOwnershipFx();
	const chatGptViewControllerOwnership = yield* createChatGptViewControllerOwnershipFx();
	const appearanceTheme = yield* appearancePreferences.readThemeFx;
	yield* Effect.sync(() => {
		nativeTheme.themeSource = appearanceTheme;
	});

	const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
	const trustedRenderer = yield* createTrustedRendererFx({
		isPackaged: app.isPackaged,
		developmentRendererUrl: process.env.ELECTRON_RENDERER_URL,
	});
	const packagedCliLauncherPath = join(dirname(process.execPath), "arkini-cli");
	const transientMacAppPath =
		process.execPath.startsWith("/Volumes/") || process.execPath.includes("/AppTranslocation/");
	const cliInstallation = yield* createFilesystemCliInstallationFx({
		commandPath: join(app.getPath("home"), ".local", "bin", "arkini-cli"),
		launcherPath: packagedCliLauncherPath,
		unavailableMessage: !app.isPackaged
			? "arkini-cli can be installed from a packaged Arkini build."
			: process.platform === "darwin"
				? transientMacAppPath
					? "Move Arkini.app from the disk image to Applications before installing arkini-cli."
					: undefined
				: `arkini-cli installation is not available on ${process.platform} yet.`,
	});
	yield* registerArkiniProtocolFx(rendererRoot);
	yield* registerArkiniElectronIpcFx({
		bundledArkpacksRoot: app.isPackaged ? join(process.resourcesPath, "game") : resolve("game"),
		trustedRenderer,
		appearancePreferences,
		cheatPreferences,
		launcherPreferences,
		windowModeControllerOwnership,
		windowPreferences,
		diagnostics,
		userDataPaths,
	});
	yield* registerEditorProjectIpcFx({
		trustedRenderer,
		ownership: editorProjectServiceOwnership,
	});
	yield* registerEditorMcpPreferencesIpcFx({
		trustedRenderer,
		ownership: editorMcpOwnership,
	});
	yield* registerCliInstallationIpcFx({
		cliInstallation,
		trustedRenderer,
	});
	yield* registerChatGptIpcFx({
		ownership: chatGptViewControllerOwnership,
		trustedRenderer,
	});
	const createWindowFx = windowPreferences.readModeFx.pipe(
		Effect.flatMap((windowMode) =>
			createMainWindowFx({
				chatGptViewControllerOwnership,
				trustedRenderer,
				windowMode,
				windowModeControllerOwnership,
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
