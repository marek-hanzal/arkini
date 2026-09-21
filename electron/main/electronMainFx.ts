import { app, BrowserWindow, dialog, nativeTheme, protocol } from "electron";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { Effect } from "effect";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { SerakkiElectronApi } from "../contract/SerakkiElectronApi";
import type { ApplicationLogRecordSchema } from "../contract/diagnostics/ApplicationLogRecord";
import { createMainWindowFx } from "./createMainWindowFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { createEditorResourceProtocolFx } from "./createEditorResourceProtocolFx";
import { handleSerakkiProtocolRequestFx } from "./handleSerakkiProtocolRequestFx";
import { createGameResourceProtocolFx } from "./createGameResourceProtocolFx";
import { registerSerakkiElectronIpcFx } from "./registerSerakkiElectronIpcFx";
import { createFilesystemAppearancePreferencesFx } from "./appearance/createFilesystemAppearancePreferencesFx";
import { createFilesystemCheatPreferencesFx } from "./cheat/createFilesystemCheatPreferencesFx";
import { createFilesystemLauncherPreferencesFx } from "./launcher/createFilesystemLauncherPreferencesFx";
import { createTrustedRendererFx } from "./security/createTrustedRendererFx";
import { createDiagnosticLogFx } from "./diagnostics/createDiagnosticLogFx";
import { createFilesystemWindowPreferencesFx } from "./window/createFilesystemWindowPreferencesFx";
import { createFilesystemSoundPreferencesFx } from "./sound/createFilesystemSoundPreferencesFx";
import { createWindowModeControllerOwnershipFx } from "./window/createWindowModeControllerOwnershipFx";
import { resolveSerakkiUserDataPathsFx } from "~/application-data/fx/resolveSerakkiUserDataPathsFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { registerEditorMcpPreferencesIpcFx } from "./editor-mcp/ipc/registerEditorMcpPreferencesIpcFx";
import { createFilesystemEditorMcpOwnershipFx } from "~/authoring-mcp/fx/createFilesystemEditorMcpOwnershipFx";
import { registerEditorProjectIpcFx } from "./editor-project/ipc/registerEditorProjectIpcFx";
import { createFilesystemEditorProjectRepositoryFx } from "~/project-authoring/filesystem/fx/createFilesystemEditorProjectRepositoryFx";
import { createInstallationFx } from "./cli/createInstallationFx";
import { createCompletionFx } from "./cli/createCompletionFx";
import { consumeApplicationHardResetFx } from "./consumeApplicationHardResetFx";
import { registerCliIpcFx } from "./cli/registerCliIpcFx";

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
	yield* Effect.sync(() => {
		app.on("window-all-closed", () => {
			app.quit();
		});
	});
	yield* Effect.promise(() => app.whenReady());

	const resetSucceeded = yield* consumeApplicationHardResetFx.pipe(
		Effect.match({
			onSuccess: () => true,
			onFailure: (cause) => {
				dialog.showErrorBox("Serakki could not reset its data", String(cause));
				app.exit(1);
				return false;
			},
		}),
	);
	if (!resetSucceeded) return;

	const userDataPaths = yield* resolveSerakkiUserDataPathsFx;
	const diagnostics = yield* createDiagnosticLogFx(userDataPaths.diagnostics).pipe(
		Effect.catch((cause) =>
			Effect.sync(() => {
				console.error("Serakki diagnostic log could not be initialized.", cause);
				return {
					directoryPath: "",
					writeFx: () => Effect.void,
					writeApplicationFx: () => Effect.void,
					openDirectoryFx: Effect.void,
					closeFx: Effect.void,
				};
			}),
		),
	);
	const formatCauseTextFn = (cause: unknown) =>
		formatApplicationDiagnosticTextFn({
			value: cause,
		});
	const writeApplicationSafelyFx = (record: ApplicationLogRecordSchema.Type) =>
		diagnostics
			.writeApplicationFx(record)
			.pipe(Effect.catch((cause) => Effect.sync(() => console.error(cause))));
	yield* diagnostics
		.writeApplicationFx({
			level: "info",
			message: "Application started",
			body: "Electron main entered the application lifecycle.",
		})
		.pipe(Effect.catch((cause) => Effect.sync(() => console.error(cause))));
	yield* Effect.sync(() => {
		const reportFatalProcessErrorFn = (
			error: Error,
			origin: NodeJS.UncaughtExceptionOrigin,
		) => {
			try {
				ElectronMainRuntime.runSync(
					diagnostics.writeApplicationFx({
						level: "fatal",
						message: "Main process crashed",
						body: formatApplicationDiagnosticTextFn({
							value: error,
							prefix: `Origin: ${origin}`,
						}),
					}),
				);
			} catch (cause) {
				console.error("Serakki could not record the fatal main-process error.", cause);
			}
		};
		process.on("uncaughtExceptionMonitor", reportFatalProcessErrorFn);
		app.once("will-quit", () => {
			process.off("uncaughtExceptionMonitor", reportFatalProcessErrorFn);
			void ElectronMainRuntime.runPromise(
				diagnostics
					.writeApplicationFx({
						level: "info",
						message: "Application stopping",
						body: "Electron emitted will-quit.",
					})
					.pipe(Effect.andThen(diagnostics.closeFx)),
			).catch((cause) => {
				console.error("Serakki diagnostic log could not be closed.", cause);
			});
		});
	});
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
				writeApplicationSafelyFx({
					level: "error",
					message: "Editor storage initialization failed",
					body: formatCauseTextFn(cause),
				}).pipe(
					Effect.tap(() =>
						Effect.sync(() =>
							console.error(
								"Serakki editor storage could not be initialized.",
								cause,
							),
						),
					),
					Effect.as({
						type: "unavailable" as const,
						message: "The editor storage could not be initialized.",
					}),
				),
			),
		);
	if (editorProjectServiceOwnership.type === "ready") {
		yield* writeApplicationSafelyFx({
			level: "info",
			message: "Editor storage ready",
			body: `Projects: ${userDataPaths.editor.projects}\nCatalog: ${userDataPaths.editor.catalog}`,
		});
		yield* Effect.sync(() => {
			app.once("will-quit", () => {
				ElectronMainRuntime.runSync(editorProjectServiceOwnership.repository.closeFx);
			});
		});
	}
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
	const soundPreferences = yield* createFilesystemSoundPreferencesFx({
		root: userDataPaths.game.preferences,
	});
	const editorMcpOwnership = yield* createFilesystemEditorMcpOwnershipFx({
		editor: editorProjectServiceOwnership,
		notifyOverviewChangedFn: (overview) => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isDestroyed()) continue;
				window.webContents.send(
					SerakkiElectronApi.channels.editorMcpOverviewChanged,
					overview,
				);
			}
		},
		notifyProjectChangedFn: (projectId) => {
			for (const window of BrowserWindow.getAllWindows()) {
				if (window.isDestroyed()) continue;
				window.webContents.send(
					SerakkiElectronApi.channels.editorProjectChanged,
					projectId,
				);
			}
		},
		root: userDataPaths.editor.root,
	});
	yield* Effect.sync(() => app.once("will-quit", editorMcpOwnership.closeSyncFn));
	const windowModeControllerOwnership = yield* createWindowModeControllerOwnershipFx();
	const appearanceTheme = yield* appearancePreferences.readThemeFx;
	yield* Effect.sync(() => {
		nativeTheme.themeSource = appearanceTheme;
	});

	const rendererRoot = fileURLToPath(new URL("../renderer", import.meta.url));
	const trustedRenderer = yield* createTrustedRendererFx({
		isPackaged: app.isPackaged,
		developmentRendererUrl: process.env.ELECTRON_RENDERER_URL,
	});
	const packagedCliLauncherPath = join(dirname(process.execPath), "serakki-cli");
	const transientMacAppPath =
		process.execPath.startsWith("/Volumes/") || process.execPath.includes("/AppTranslocation/");
	const cliUnavailableMessage = !app.isPackaged
		? "serakki-cli can be installed from a packaged Serakki build."
		: process.platform === "darwin"
			? transientMacAppPath
				? "Move Serakki.app from the disk image to Applications before installing serakki-cli."
				: undefined
			: `serakki-cli installation is not available on ${process.platform} yet.`;
	const homePath = app.getPath("home");
	const cliInstallation = yield* createInstallationFx({
		commandPath: join(homePath, ".local", "bin", "serakki-cli"),
		launcherPath: packagedCliLauncherPath,
		unavailableMessage: cliUnavailableMessage,
	});
	const shellName = basename(process.env.SHELL ?? "");
	const cliCompletion = yield* createCompletionFx({
		completion:
			shellName === "zsh"
				? {
						path: join(homePath, ".zsh", "completions", "_serakki-cli"),
						shell: "zsh",
					}
				: shellName === "bash"
					? {
							path: join(
								homePath,
								".local",
								"share",
								"bash-completion",
								"completions",
								"serakki-cli",
							),
							shell: "bash",
						}
					: shellName === "fish"
						? {
								path: join(
									homePath,
									".config",
									"fish",
									"completions",
									"serakki-cli.fish",
								),
								shell: "fish",
							}
						: undefined,
		launcherPath: packagedCliLauncherPath,
		unavailableMessage: cliUnavailableMessage,
	});
	const editorResourceProtocol =
		editorProjectServiceOwnership.type === "ready"
			? yield* createEditorResourceProtocolFx({
					readResourceLocationFx:
						editorProjectServiceOwnership.repository.readResourceLocationFx,
					isTrustedUrlFn: trustedRenderer.isTrustedUrlFn,
				})
			: undefined;
	const gameResourceProtocol = yield* createGameResourceProtocolFx({
		installationsRoot: userDataPaths.game.installations,
		isTrustedUrlFn: trustedRenderer.isTrustedUrlFn,
	});
	yield* Effect.sync(() => {
		protocol.handle("serakki", (request) =>
			ElectronMainRuntime.runPromise(
				handleSerakkiProtocolRequestFx({
					request,
					rendererRoot,
					handleEditorResourceRequestFx: editorResourceProtocol?.handleRequestFx,
					handleGameResourceRequestFx: gameResourceProtocol.handleRequestFx,
				}),
			),
		);
	});
	yield* registerSerakkiElectronIpcFx({
		bundledSerapacksRoot: app.isPackaged
			? join(process.resourcesPath, "game")
			: resolve("game/serakki/build"),
		trustedRenderer,
		appearancePreferences,
		cheatPreferences,
		launcherPreferences,
		soundPreferences,
		windowModeControllerOwnership,
		windowPreferences,
		diagnostics,
		userDataPaths,
		editorProjectServiceOwnership,
	});
	yield* registerEditorProjectIpcFx({
		bundledSerapacksRoot: app.isPackaged
			? join(process.resourcesPath, "game")
			: resolve("game/serakki/build"),
		diagnostics,
		trustedRenderer,
		ownership: editorProjectServiceOwnership,
		userSerapacksRoot: userDataPaths.game.serapacks,
	});
	yield* registerEditorMcpPreferencesIpcFx({
		trustedRenderer,
		ownership: editorMcpOwnership,
	});
	yield* registerCliIpcFx({
		completion: cliCompletion,
		installation: cliInstallation,
		trustedRenderer,
	});
	const createWindowFx = windowPreferences.readModeFx.pipe(
		Effect.flatMap((windowMode) =>
			createMainWindowFx({
				trustedRenderer,
				windowMode,
				windowModeControllerOwnership,
				windowPreferences,
			}),
		),
	);
	yield* createWindowFx;
	yield* writeApplicationSafelyFx({
		level: "info",
		message: "Main window loaded",
		body: "The renderer loaded and the native window was registered.",
	});

	yield* Effect.sync(() => {
		app.on("activate", () => {
			if (BrowserWindow.getAllWindows().length === 0) {
				void ElectronMainRuntime.runPromise(createWindowFx).catch((error) => {
					console.error("Serakki could not create a replacement window.", error);
					void ElectronMainRuntime.runPromise(
						writeApplicationSafelyFx({
							level: "error",
							message: "Replacement window creation failed",
							body: formatCauseTextFn(error),
						}),
					);
				});
			}
		});
	});
});
