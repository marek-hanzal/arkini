import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	nativeTheme,
	shell,
	type IpcMainInvokeEvent,
} from "electron";
import { Effect } from "effect";
import { mkdir } from "node:fs/promises";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
import { createFilesystemArkpackCatalogFx } from "./arkpack/createFilesystemArkpackCatalogFx";
import type { AppearancePreferences } from "./appearance/createFilesystemAppearancePreferencesFx";
import type { CheatPreferences } from "./cheat/createFilesystemCheatPreferencesFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import type { LauncherPreferences } from "./launcher/createFilesystemLauncherPreferencesFx";
import { createFilesystemGameSaveFilesFx } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";
import type { ArkiniUserDataPaths } from "~/application-data/fn/createArkiniUserDataPathsFn";
import type { TrustedRenderer } from "./security/TrustedRenderer";
import { DiagnosticRecordSchema } from "../contract/diagnostics/DiagnosticRecord";
import { ApplicationLogRecordSchema } from "../contract/diagnostics/ApplicationLogRecord";
import { GameIncidentWriteSchema } from "../contract/incident/GameIncidentWrite";
import type { DiagnosticLog } from "./diagnostics/createDiagnosticLogFx";
import { writeLatestGameIncidentFx } from "./incident/writeLatestGameIncidentFx";
import { WindowModeSchema } from "../contract/window/WindowModeSchema";
import type { WindowPreferences } from "./window/createFilesystemWindowPreferencesFx";
import type { SoundPreferences } from "./sound/createFilesystemSoundPreferencesFx";
import { SoundVolumeSchema } from "../contract/sound/SoundVolumeSchema";
import { SoundChannelSchema } from "../contract/sound/SoundSettings";
import type { WindowModeControllerOwnership } from "./window/createWindowModeControllerOwnershipFx";
import type { EditorProjectServiceOwnership } from "~/project-authoring/service/EditorProjectServiceOwnership";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { z } from "zod";

let registered = false;
const maxClipboardTextLength = 65_536;

export namespace registerArkiniElectronIpcFx {
	export interface Props {
		readonly bundledArkpacksRoot: string;
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
		readonly cheatPreferences: CheatPreferences;
		readonly launcherPreferences: LauncherPreferences;
		readonly soundPreferences: SoundPreferences;
		readonly windowModeControllerOwnership: WindowModeControllerOwnership;
		readonly windowPreferences: WindowPreferences;
		readonly diagnostics: DiagnosticLog;
		readonly userDataPaths: ArkiniUserDataPaths;
		readonly editorProjectServiceOwnership: EditorProjectServiceOwnership;
	}
}

/** Registers the narrow Arkini Electron capabilities exposed through preload. */
export const registerArkiniElectronIpcFx = Effect.fn("registerArkiniElectronIpcFx")(
	({
		bundledArkpacksRoot,
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
	}: registerArkiniElectronIpcFx.Props) =>
		Effect.gen(function* () {
			if (registered) return;
			registered = true;
			const arkpacks = yield* createFilesystemArkpackCatalogFx({
				bundledRoot: bundledArkpacksRoot,
				installationsRoot: userDataPaths.game.installations,
				userRoot: userDataPaths.game.arkpacks,
			});
			const saves = yield* createFilesystemGameSaveFilesFx({
				root: userDataPaths.game.saves,
			});
			yield* Effect.sync(() => {
				const synchronizeWindowBackgroundsFn = () => {
					const color = nativeTheme.shouldUseDarkColors ? "#090711" : "#fbf8ff";
					for (const window of BrowserWindow.getAllWindows()) {
						window.setBackgroundColor(color);
					}
				};
				const runAuthorizedFn = <Value, Error>(
					event: IpcMainInvokeEvent,
					operation: Effect.Effect<Value, Error, never>,
				) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(operation)),
					);

				nativeTheme.on("updated", synchronizeWindowBackgroundsFn);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceRead, (event) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => nativeTheme.themeSource),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceWrite, (event, theme) =>
					runAuthorizedFn(
						event,
						appearancePreferences.writeThemeFx(theme).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									nativeTheme.themeSource = theme;
									synchronizeWindowBackgroundsFn();
								}),
							),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceAccentRead, (event) =>
					runAuthorizedFn(event, appearancePreferences.readAccentFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceAccentWrite, (event, accent) =>
					runAuthorizedFn(event, appearancePreferences.writeAccentFx(accent)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.cheatAvailabilityRead, (event) =>
					runAuthorizedFn(event, cheatPreferences.readAvailableFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.soundRead, (event) =>
					runAuthorizedFn(event, soundPreferences.readFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.soundWrite, (event, channel, candidate) =>
					runAuthorizedFn(
						event,
						Effect.try({
							try: () => ({
								channel: SoundChannelSchema.parse(channel),
								volume: SoundVolumeSchema.parse(candidate),
							}),
							catch: (cause) => cause,
						}).pipe(
							Effect.flatMap(({ channel: parsedChannel, volume }) =>
								soundPreferences.writeFx(parsedChannel, volume),
							),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.clipboardWriteText, (event, candidate) =>
					runAuthorizedFn(
						event,
						Effect.tryPromise({
							try: async () => {
								if (
									typeof candidate !== "string" ||
									candidate.length > maxClipboardTextLength
								) {
									throw new Error("Clipboard text is invalid or too large.");
								}
								await clipboard.writeText(candidate);
							},
							catch: (cause) => cause,
						}),
					),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.cheatAvailabilityWrite,
					(event, available) =>
						runAuthorizedFn(event, cheatPreferences.writeAvailableFx(available)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.launcherLastPackageIdRead, (event) =>
					runAuthorizedFn(event, launcherPreferences.readLastPackageIdFx),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.localizationPreferredLanguagesRead,
					(event) =>
						runAuthorizedFn(
							event,
							Effect.sync(() => app.getPreferredSystemLanguages()),
						),
				);
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsWrite, (event, record) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => DiagnosticRecordSchema.parse(record)).pipe(
							Effect.flatMap(diagnostics.writeFx),
						),
					),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.diagnosticsWriteApplication,
					(event, record) =>
						runAuthorizedFn(
							event,
							Effect.sync(() => ApplicationLogRecordSchema.parse(record)).pipe(
								Effect.flatMap(diagnostics.writeApplicationFx),
							),
						),
				);
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsOpenDirectory, (event) =>
					runAuthorizedFn(event, diagnostics.openDirectoryFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.incidentWrite, (event, candidate) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => GameIncidentWriteSchema.parse(candidate)).pipe(
							Effect.flatMap((incident) =>
								writeLatestGameIncidentFx({
									bundledArkpacksRoot,
									incidentsRoot: userDataPaths.game.incidents,
									incident,
									userArkpacksRoot: userDataPaths.game.arkpacks,
								}),
							),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.userDataOpenDirectory, (event) =>
					runAuthorizedFn(
						event,
						Effect.tryPromise({
							try: async () => {
								const error = await shell.openPath(userDataPaths.root);
								if (error !== "") throw new Error(error);
							},
							catch: (cause) => cause,
						}),
					),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.launcherLastPackageIdWrite,
					(event, packageId) =>
						runAuthorizedFn(event, launcherPreferences.writeLastPackageIdFx(packageId)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.windowModeRead, (event) =>
					runAuthorizedFn(event, windowPreferences.readModeFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.windowModeWrite, (event, candidate) =>
					runAuthorizedFn(
						event,
						Effect.gen(function* () {
							const mode = yield* Effect.try({
								try: () => WindowModeSchema.parse(candidate),
								catch: (cause) => cause,
							});
							const window = BrowserWindow.fromWebContents(event.sender);
							if (window === null) {
								return yield* Effect.fail(
									new Error("The trusted renderer has no owning BrowserWindow."),
								);
							}
							const controller =
								yield* windowModeControllerOwnership.readControllerFx(window);
							yield* controller.requestModeFx(mode);
						}),
					),
				);

				ipcMain.handle(ArkiniElectronApi.channels.arkpackList, (event) =>
					runAuthorizedFn(event, arkpacks.listFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.arkpackRead, (event, packageId: string) =>
					runAuthorizedFn(event, arkpacks.readFx(packageId)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.arkpackImport, (event) =>
					runAuthorizedFn(
						event,
						Effect.gen(function* () {
							const window = BrowserWindow.fromWebContents(event.sender);
							if (window === null)
								return yield* Effect.fail(
									new Error("The Arkpack picker window is unavailable."),
								);
							const selection = yield* Effect.promise(() =>
								dialog.showOpenDialog(window, {
									properties: [
										"openFile",
									],
									filters: [
										{
											name: "Arkpack",
											extensions: [
												"arkpack",
											],
										},
									],
								}),
							);
							const sourcePath = selection.filePaths[0];
							return selection.canceled || sourcePath === undefined
								? null
								: yield* arkpacks.importFx(sourcePath);
						}),
					),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackInstallEditorBuild,
					(event, candidate) =>
						runAuthorizedFn(
							event,
							Effect.gen(function* () {
								if (editorProjectServiceOwnership.type !== "ready")
									return yield* Effect.fail(
										new Error(editorProjectServiceOwnership.message),
									);
								const request = z
									.object({
										packageId: IdSchema,
										expectedRevision: z.number().int().nonnegative(),
										contentHash: z.string().regex(/^[a-f0-9]{64}$/),
									})
									.strict()
									.parse(candidate);
								return yield* editorProjectServiceOwnership.repository.withProjectBuildPathFx(
									{
										projectId: request.packageId,
										expectedRevision: request.expectedRevision,
										contentHash: request.contentHash,
									},
									arkpacks.importFx,
								);
							}),
						),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackRemove,
					(event, packageId: string) =>
						runAuthorizedFn(event, arkpacks.removeFx(packageId)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.arkpackOpenUserDirectory, (event) =>
					runAuthorizedFn(
						event,
						Effect.tryPromise({
							try: async () => {
								await mkdir(userDataPaths.game.arkpacks, {
									recursive: true,
								});
								const error = await shell.openPath(userDataPaths.game.arkpacks);
								if (error !== "") throw new Error(error);
							},
							catch: (cause) => cause,
						}),
					),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveRead,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorizedFn(event, saves.readFx(key)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveWrite,
					(event, key: ArkiniElectronApi.SaveKey, bytes: Uint8Array) =>
						runAuthorizedFn(event, saves.writeFx(key, bytes)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveClear,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorizedFn(event, saves.clearFx(key)),
				);

				const cleanupFn = () => {
					nativeTheme.removeListener("updated", synchronizeWindowBackgroundsFn);
					for (const channel of [
						ArkiniElectronApi.channels.appearanceRead,
						ArkiniElectronApi.channels.appearanceWrite,
						ArkiniElectronApi.channels.appearanceAccentRead,
						ArkiniElectronApi.channels.appearanceAccentWrite,
						ArkiniElectronApi.channels.cheatAvailabilityRead,
						ArkiniElectronApi.channels.cheatAvailabilityWrite,
						ArkiniElectronApi.channels.soundRead,
						ArkiniElectronApi.channels.soundWrite,
						ArkiniElectronApi.channels.clipboardWriteText,
						ArkiniElectronApi.channels.launcherLastPackageIdRead,
						ArkiniElectronApi.channels.launcherLastPackageIdWrite,
						ArkiniElectronApi.channels.localizationPreferredLanguagesRead,
						ArkiniElectronApi.channels.arkpackList,
						ArkiniElectronApi.channels.arkpackRead,
						ArkiniElectronApi.channels.arkpackImport,
						ArkiniElectronApi.channels.arkpackInstallEditorBuild,
						ArkiniElectronApi.channels.arkpackRemove,
						ArkiniElectronApi.channels.arkpackOpenUserDirectory,
						ArkiniElectronApi.channels.saveRead,
						ArkiniElectronApi.channels.saveWrite,
						ArkiniElectronApi.channels.saveClear,
						ArkiniElectronApi.channels.diagnosticsWrite,
						ArkiniElectronApi.channels.diagnosticsWriteApplication,
						ArkiniElectronApi.channels.diagnosticsOpenDirectory,
						ArkiniElectronApi.channels.incidentWrite,
						ArkiniElectronApi.channels.userDataOpenDirectory,
						ArkiniElectronApi.channels.windowModeRead,
						ArkiniElectronApi.channels.windowModeWrite,
					]) {
						ipcMain.removeHandler(channel);
					}
					registered = false;
				};
				app.once("will-quit", cleanupFn);
			});
		}),
);
