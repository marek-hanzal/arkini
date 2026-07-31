import { app, BrowserWindow, ipcMain, nativeTheme, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
import type { EditorProjectWrite } from "../contract/editor/EditorProjectWrite";
import type { EditorProjectCreate } from "../contract/editor/EditorProjectRecord";
import { createFilesystemArkpackCatalogFx } from "./arkpack/createFilesystemArkpackCatalogFx";
import type { AppearancePreferences } from "./appearance/AppearancePreferences";
import type { CheatPreferences } from "./cheat/CheatPreferences";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import type { LauncherPreferences } from "./launcher/LauncherPreferences";
import { createFilesystemGameSaveFilesFx } from "./save/createFilesystemGameSaveFilesFx";
import { createFilesystemEditorWorkspaceFx } from "./editor/createFilesystemEditorWorkspaceFx";
import type { ArkiniUserDataPaths } from "./user-data/ArkiniUserDataPaths";
import type { TrustedRenderer } from "./security/TrustedRenderer";
import { DiagnosticRecordSchema } from "../contract/diagnostics/DiagnosticRecord";
import type { DiagnosticLog } from "./diagnostics/DiagnosticLog";
import { WindowModeSchema } from "../contract/window/WindowModeSchema";
import type { WindowPreferences } from "./window/WindowPreferences";
import { readWindowModeControllerFx } from "./window/WindowModeControllerRegistry";

let registered = false;

export namespace registerArkiniElectronIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
		readonly cheatPreferences: CheatPreferences;
		readonly launcherPreferences: LauncherPreferences;
		readonly windowPreferences: WindowPreferences;
		readonly diagnostics: DiagnosticLog;
		readonly userDataPaths: ArkiniUserDataPaths;
	}
}

/** Registers the narrow Arkini Electron capabilities exposed through preload. */
export const registerArkiniElectronIpcFx = Effect.fn("registerArkiniElectronIpcFx")(
	({
		trustedRenderer,
		appearancePreferences,
		cheatPreferences,
		launcherPreferences,
		windowPreferences,
		diagnostics,
		userDataPaths,
	}: registerArkiniElectronIpcFx.Props) =>
		Effect.gen(function* () {
			if (registered) return;
			registered = true;
			const arkpacks = yield* createFilesystemArkpackCatalogFx({
				root: userDataPaths.game.arkpacks,
			});
			const saves = yield* createFilesystemGameSaveFilesFx({
				root: userDataPaths.game.saves,
			});
			const editor = yield* createFilesystemEditorWorkspaceFx({
				root: userDataPaths.editor,
			});
			yield* Effect.sync(() => {
				const synchronizeWindowBackgrounds = () => {
					const color = nativeTheme.shouldUseDarkColors ? "#090711" : "#fbf8ff";
					for (const window of BrowserWindow.getAllWindows()) {
						window.setBackgroundColor(color);
					}
				};
				const runAuthorized = <Value, Error>(
					event: IpcMainInvokeEvent,
					operation: Effect.Effect<Value, Error>,
				) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.andThen(operation)),
					);

				nativeTheme.on("updated", synchronizeWindowBackgrounds);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceRead, (event) =>
					runAuthorized(
						event,
						Effect.sync(() => nativeTheme.themeSource),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceWrite, (event, theme) =>
					runAuthorized(
						event,
						appearancePreferences.writeThemeFx(theme).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									nativeTheme.themeSource = theme;
									synchronizeWindowBackgrounds();
								}),
							),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceAccentRead, (event) =>
					runAuthorized(event, appearancePreferences.readAccentFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceAccentWrite, (event, accent) =>
					runAuthorized(event, appearancePreferences.writeAccentFx(accent)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.cheatAvailabilityRead, (event) =>
					runAuthorized(event, cheatPreferences.readAvailableFx),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.cheatAvailabilityWrite,
					(event, available) =>
						runAuthorized(event, cheatPreferences.writeAvailableFx(available)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.launcherLastPackageIdRead, (event) =>
					runAuthorized(event, launcherPreferences.readLastPackageIdFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsWrite, (event, record) =>
					runAuthorized(
						event,
						Effect.sync(() => DiagnosticRecordSchema.parse(record)).pipe(
							Effect.flatMap(diagnostics.writeFx),
						),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.diagnosticsOpenDirectory, (event) =>
					runAuthorized(event, diagnostics.openDirectoryFx),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.launcherLastPackageIdWrite,
					(event, packageId) =>
						runAuthorized(event, launcherPreferences.writeLastPackageIdFx(packageId)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.windowModeRead, (event) =>
					runAuthorized(event, windowPreferences.readModeFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.windowModeWrite, (event, candidate) =>
					runAuthorized(
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
							const controller = yield* readWindowModeControllerFx(window);
							yield* controller.requestModeFx(mode);
						}),
					),
				);

				ipcMain.handle(ArkiniElectronApi.channels.arkpackList, (event) =>
					runAuthorized(event, arkpacks.listFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.arkpackRead, (event, packageId: string) =>
					runAuthorized(event, arkpacks.readFx(packageId)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackInstall,
					(event, record: ArkiniElectronApi.ArkpackRecord) =>
						runAuthorized(event, arkpacks.installFx(record)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackRemove,
					(event, packageId: string) =>
						runAuthorized(event, arkpacks.removeFx(packageId)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.editorProjectList, (event) =>
					runAuthorized(event, editor.listFx()),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.editorProjectCreate,
					(event, record: EditorProjectCreate) =>
						runAuthorized(event, editor.createFx(record)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.editorProjectRead,
					(event, projectId: string) => runAuthorized(event, editor.readFx(projectId)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.editorProjectWrite,
					(event, mutation: EditorProjectWrite) =>
						runAuthorized(event, editor.writeFx(mutation)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.editorDirectoryOpen,
					(event, projectId?: string) =>
						runAuthorized(event, editor.openDirectoryFx(projectId)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveRead,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorized(event, saves.readFx(key)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveWrite,
					(event, key: ArkiniElectronApi.SaveKey, bytes: Uint8Array) =>
						runAuthorized(event, saves.writeFx(key, bytes)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveClear,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorized(event, saves.clearFx(key)),
				);

				const cleanup = () => {
					nativeTheme.removeListener("updated", synchronizeWindowBackgrounds);
					for (const channel of [
						ArkiniElectronApi.channels.appearanceRead,
						ArkiniElectronApi.channels.appearanceWrite,
						ArkiniElectronApi.channels.appearanceAccentRead,
						ArkiniElectronApi.channels.appearanceAccentWrite,
						ArkiniElectronApi.channels.cheatAvailabilityRead,
						ArkiniElectronApi.channels.cheatAvailabilityWrite,
						ArkiniElectronApi.channels.launcherLastPackageIdRead,
						ArkiniElectronApi.channels.launcherLastPackageIdWrite,
						ArkiniElectronApi.channels.arkpackList,
						ArkiniElectronApi.channels.arkpackRead,
						ArkiniElectronApi.channels.arkpackInstall,
						ArkiniElectronApi.channels.arkpackRemove,
						ArkiniElectronApi.channels.editorProjectList,
						ArkiniElectronApi.channels.editorProjectCreate,
						ArkiniElectronApi.channels.editorProjectRead,
						ArkiniElectronApi.channels.editorProjectWrite,
						ArkiniElectronApi.channels.editorDirectoryOpen,
						ArkiniElectronApi.channels.saveRead,
						ArkiniElectronApi.channels.saveWrite,
						ArkiniElectronApi.channels.saveClear,
						ArkiniElectronApi.channels.diagnosticsWrite,
						ArkiniElectronApi.channels.diagnosticsOpenDirectory,
						ArkiniElectronApi.channels.windowModeRead,
						ArkiniElectronApi.channels.windowModeWrite,
					]) {
						ipcMain.removeHandler(channel);
					}
					registered = false;
				};
				app.once("will-quit", cleanup);
			});
		}),
);
