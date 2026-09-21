import type { GameSaveSlotSchema } from "~/game-persistence/schema/GameSaveSlotSchema";
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
import { SerakkiElectronApi } from "../contract/SerakkiElectronApi";
import { createFilesystemSerapackCatalogFx } from "./serapack/createFilesystemSerapackCatalogFx";
import type { AppearancePreferences } from "./appearance/createFilesystemAppearancePreferencesFx";
import type { CheatPreferences } from "./cheat/createFilesystemCheatPreferencesFx";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import type { LauncherPreferences } from "./launcher/createFilesystemLauncherPreferencesFx";
import { createFilesystemGameSaveFilesFx } from "~/game-persistence/fx/createFilesystemGameSaveFilesFx";
import type { SerakkiUserDataPaths } from "~/application-data/fn/createSerakkiUserDataPathsFn";
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
import { requestApplicationHardResetFx } from "./requestApplicationHardResetFx";

let registered = false;
const maxClipboardTextLength = 65_536;

export namespace registerSerakkiElectronIpcFx {
	export interface Props {
		readonly bundledSerapacksRoot: string;
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
		readonly cheatPreferences: CheatPreferences;
		readonly launcherPreferences: LauncherPreferences;
		readonly soundPreferences: SoundPreferences;
		readonly windowModeControllerOwnership: WindowModeControllerOwnership;
		readonly windowPreferences: WindowPreferences;
		readonly diagnostics: DiagnosticLog;
		readonly userDataPaths: SerakkiUserDataPaths;
		readonly editorProjectServiceOwnership: EditorProjectServiceOwnership;
	}
}

/** Registers the narrow Serakki Electron capabilities exposed through preload. */
export const registerSerakkiElectronIpcFx = Effect.fn("registerSerakkiElectronIpcFx")(
	({
		bundledSerapacksRoot,
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
	}: registerSerakkiElectronIpcFx.Props) =>
		Effect.gen(function* () {
			if (registered) return;
			registered = true;
			const serapacks = yield* createFilesystemSerapackCatalogFx({
				bundledRoot: bundledSerapacksRoot,
				installationsRoot: userDataPaths.game.installations,
				userRoot: userDataPaths.game.serapacks,
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
				ipcMain.handle(SerakkiElectronApi.channels.appearanceRead, (event) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => nativeTheme.themeSource),
					),
				);
				ipcMain.handle(SerakkiElectronApi.channels.appearanceWrite, (event, theme) =>
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
				ipcMain.handle(SerakkiElectronApi.channels.appearanceAccentRead, (event) =>
					runAuthorizedFn(event, appearancePreferences.readAccentFx),
				);
				ipcMain.handle(SerakkiElectronApi.channels.appearanceAccentWrite, (event, accent) =>
					runAuthorizedFn(event, appearancePreferences.writeAccentFx(accent)),
				);
				ipcMain.handle(SerakkiElectronApi.channels.cheatAvailabilityRead, (event) =>
					runAuthorizedFn(event, cheatPreferences.readAvailableFx),
				);
				ipcMain.handle(SerakkiElectronApi.channels.soundRead, (event) =>
					runAuthorizedFn(event, soundPreferences.readFx),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.soundWrite,
					(event, channel, candidate) =>
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
				ipcMain.handle(SerakkiElectronApi.channels.clipboardWriteText, (event, candidate) =>
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
					SerakkiElectronApi.channels.cheatAvailabilityWrite,
					(event, available) =>
						runAuthorizedFn(event, cheatPreferences.writeAvailableFx(available)),
				);
				ipcMain.handle(SerakkiElectronApi.channels.launcherLastPackageIdRead, (event) =>
					runAuthorizedFn(event, launcherPreferences.readLastPackageIdFx),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.localizationPreferredLanguagesRead,
					(event) =>
						runAuthorizedFn(
							event,
							Effect.sync(() => app.getPreferredSystemLanguages()),
						),
				);
				ipcMain.handle(SerakkiElectronApi.channels.diagnosticsWrite, (event, record) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => DiagnosticRecordSchema.parse(record)).pipe(
							Effect.flatMap(diagnostics.writeFx),
						),
					),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.diagnosticsWriteApplication,
					(event, record) =>
						runAuthorizedFn(
							event,
							Effect.sync(() => ApplicationLogRecordSchema.parse(record)).pipe(
								Effect.flatMap(diagnostics.writeApplicationFx),
							),
						),
				);
				ipcMain.handle(SerakkiElectronApi.channels.diagnosticsOpenDirectory, (event) =>
					runAuthorizedFn(event, diagnostics.openDirectoryFx),
				);
				ipcMain.handle(SerakkiElectronApi.channels.incidentWrite, (event, candidate) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => GameIncidentWriteSchema.parse(candidate)).pipe(
							Effect.flatMap((incident) =>
								writeLatestGameIncidentFx({
									bundledSerapacksRoot,
									incidentsRoot: userDataPaths.game.incidents,
									incident,
									userSerapacksRoot: userDataPaths.game.serapacks,
								}),
							),
						),
					),
				);
				ipcMain.handle(SerakkiElectronApi.channels.userDataHardReset, (event) =>
					runAuthorizedFn(event, requestApplicationHardResetFx),
				);
				ipcMain.handle(SerakkiElectronApi.channels.userDataOpenDirectory, (event) =>
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
					SerakkiElectronApi.channels.launcherLastPackageIdWrite,
					(event, packageId) =>
						runAuthorizedFn(event, launcherPreferences.writeLastPackageIdFx(packageId)),
				);
				ipcMain.handle(SerakkiElectronApi.channels.windowModeRead, (event) =>
					runAuthorizedFn(event, windowPreferences.readModeFx),
				);
				ipcMain.handle(SerakkiElectronApi.channels.windowModeWrite, (event, candidate) =>
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

				ipcMain.handle(SerakkiElectronApi.channels.serapackList, (event) =>
					runAuthorizedFn(event, serapacks.listFx),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.serapackRead,
					(event, packageId: string) =>
						runAuthorizedFn(event, serapacks.readFx(packageId)),
				);
				ipcMain.handle(SerakkiElectronApi.channels.serapackImport, (event) =>
					runAuthorizedFn(
						event,
						Effect.gen(function* () {
							const window = BrowserWindow.fromWebContents(event.sender);
							if (window === null)
								return yield* Effect.fail(
									new Error("The Serapack picker window is unavailable."),
								);
							const selection = yield* Effect.promise(() =>
								dialog.showOpenDialog(window, {
									properties: [
										"openFile",
									],
									filters: [
										{
											name: "Serapack",
											extensions: [
												"serapack",
											],
										},
									],
								}),
							);
							const sourcePath = selection.filePaths[0];
							return selection.canceled || sourcePath === undefined
								? null
								: yield* serapacks.importFx(sourcePath);
						}),
					),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.serapackInstallEditorBuild,
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
									serapacks.importFx,
								);
							}),
						),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.serapackRemove,
					(event, packageId: string) =>
						runAuthorizedFn(event, serapacks.removeFx(packageId)),
				);
				ipcMain.handle(SerakkiElectronApi.channels.serapackOpenUserDirectory, (event) =>
					runAuthorizedFn(
						event,
						Effect.tryPromise({
							try: async () => {
								await mkdir(userDataPaths.game.serapacks, {
									recursive: true,
								});
								const error = await shell.openPath(userDataPaths.game.serapacks);
								if (error !== "") throw new Error(error);
							},
							catch: (cause) => cause,
						}),
					),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.saveRead,
					(event, key: SerakkiElectronApi.SaveKey, slot?: GameSaveSlotSchema.Type) =>
						runAuthorizedFn(event, saves.readFx(key, slot)),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.saveWrite,
					(
						event,
						key: SerakkiElectronApi.SaveKey,
						bytes: Uint8Array,
						slot?: "current" | "manual",
					) => runAuthorizedFn(event, saves.writeFx(key, bytes, slot)),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.saveClear,
					(event, key: SerakkiElectronApi.SaveKey) =>
						runAuthorizedFn(event, saves.clearFx(key)),
				);

				ipcMain.handle(
					SerakkiElectronApi.channels.saveList,
					(event, key: SerakkiElectronApi.SaveKey) =>
						runAuthorizedFn(event, saves.listFx(key)),
				);
				ipcMain.handle(
					SerakkiElectronApi.channels.saveRestore,
					(event, key: SerakkiElectronApi.SaveKey, bytes: Uint8Array) =>
						runAuthorizedFn(event, saves.restoreFx(key, bytes)),
				);
				const cleanupFn = () => {
					nativeTheme.removeListener("updated", synchronizeWindowBackgroundsFn);
					for (const channel of [
						SerakkiElectronApi.channels.appearanceRead,
						SerakkiElectronApi.channels.appearanceWrite,
						SerakkiElectronApi.channels.appearanceAccentRead,
						SerakkiElectronApi.channels.appearanceAccentWrite,
						SerakkiElectronApi.channels.cheatAvailabilityRead,
						SerakkiElectronApi.channels.cheatAvailabilityWrite,
						SerakkiElectronApi.channels.soundRead,
						SerakkiElectronApi.channels.soundWrite,
						SerakkiElectronApi.channels.clipboardWriteText,
						SerakkiElectronApi.channels.launcherLastPackageIdRead,
						SerakkiElectronApi.channels.launcherLastPackageIdWrite,
						SerakkiElectronApi.channels.localizationPreferredLanguagesRead,
						SerakkiElectronApi.channels.serapackList,
						SerakkiElectronApi.channels.serapackRead,
						SerakkiElectronApi.channels.serapackImport,
						SerakkiElectronApi.channels.serapackInstallEditorBuild,
						SerakkiElectronApi.channels.serapackRemove,
						SerakkiElectronApi.channels.serapackOpenUserDirectory,
						SerakkiElectronApi.channels.saveRead,
						SerakkiElectronApi.channels.saveWrite,
						SerakkiElectronApi.channels.saveClear,
						SerakkiElectronApi.channels.saveList,
						SerakkiElectronApi.channels.saveRestore,
						SerakkiElectronApi.channels.diagnosticsWrite,
						SerakkiElectronApi.channels.diagnosticsWriteApplication,
						SerakkiElectronApi.channels.diagnosticsOpenDirectory,
						SerakkiElectronApi.channels.incidentWrite,
						SerakkiElectronApi.channels.userDataOpenDirectory,
						SerakkiElectronApi.channels.userDataHardReset,
						SerakkiElectronApi.channels.windowModeRead,
						SerakkiElectronApi.channels.windowModeWrite,
					]) {
						ipcMain.removeHandler(channel);
					}
					registered = false;
				};
				app.once("will-quit", cleanupFn);
			});
		}),
);
