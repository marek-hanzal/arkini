import {
	app,
	BrowserWindow,
	clipboard,
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
import type { ArkiniUserDataPaths } from "./user-data/ArkiniUserDataPaths";
import type { TrustedRenderer } from "./security/TrustedRenderer";
import { DiagnosticRecordSchema } from "../contract/diagnostics/DiagnosticRecord";
import type { DiagnosticLog } from "./diagnostics/createDiagnosticLogFx";
import { WindowModeSchema } from "../contract/window/WindowModeSchema";
import type { WindowPreferences } from "./window/createFilesystemWindowPreferencesFx";
import type { WindowModeControllerOwnership } from "./window/createWindowModeControllerOwnershipFx";

let registered = false;
const maxClipboardTextLength = 65_536;

export namespace registerArkiniElectronIpcFx {
	export interface Props {
		readonly bundledArkpacksRoot: string;
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
		readonly cheatPreferences: CheatPreferences;
		readonly launcherPreferences: LauncherPreferences;
		readonly windowModeControllerOwnership: WindowModeControllerOwnership;
		readonly windowPreferences: WindowPreferences;
		readonly diagnostics: DiagnosticLog;
		readonly userDataPaths: ArkiniUserDataPaths;
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
		windowModeControllerOwnership,
		windowPreferences,
		diagnostics,
		userDataPaths,
	}: registerArkiniElectronIpcFx.Props) =>
		Effect.gen(function* () {
			if (registered) return;
			registered = true;
			const arkpacks = yield* createFilesystemArkpackCatalogFx({
				bundledRoot: bundledArkpacksRoot,
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
				ipcMain.handle(ArkiniElectronApi.channels.clipboardWriteText, (event, candidate) =>
					runAuthorizedFn(
						event,
						Effect.try({
							try: () => {
								if (
									typeof candidate !== "string" ||
									candidate.length > maxClipboardTextLength
								) {
									throw new Error("Clipboard text is invalid or too large.");
								}
								clipboard.writeText(candidate);
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
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsWrite, (event, record) =>
					runAuthorizedFn(
						event,
						Effect.sync(() => DiagnosticRecordSchema.parse(record)).pipe(
							Effect.flatMap(diagnostics.writeFx),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsOpenDirectory, (event) =>
					runAuthorizedFn(event, diagnostics.openDirectoryFx),
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
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackInstall,
					(event, record: ArkiniElectronApi.ArkpackInstall) =>
						runAuthorizedFn(event, arkpacks.installFx(record)),
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
						ArkiniElectronApi.channels.clipboardWriteText,
						ArkiniElectronApi.channels.launcherLastPackageIdRead,
						ArkiniElectronApi.channels.launcherLastPackageIdWrite,
						ArkiniElectronApi.channels.arkpackList,
						ArkiniElectronApi.channels.arkpackRead,
						ArkiniElectronApi.channels.arkpackInstall,
						ArkiniElectronApi.channels.arkpackRemove,
						ArkiniElectronApi.channels.arkpackOpenUserDirectory,
						ArkiniElectronApi.channels.saveRead,
						ArkiniElectronApi.channels.saveWrite,
						ArkiniElectronApi.channels.saveClear,
						ArkiniElectronApi.channels.diagnosticsWrite,
						ArkiniElectronApi.channels.diagnosticsOpenDirectory,
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
