import { app, BrowserWindow, ipcMain, nativeTheme, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
import { createFilesystemArkpackCatalogFx } from "./arkpack/createFilesystemArkpackCatalogFx";
import type { AppearancePreferences } from "./appearance/AppearancePreferences";
import type { CheatPreferences } from "./cheat/CheatPreferences";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import type { LauncherPreferences } from "./launcher/LauncherPreferences";
import { createFilesystemGameSaveFilesFx } from "./save/createFilesystemGameSaveFilesFx";
import type { TrustedRenderer } from "./security/TrustedRenderer";

let registered = false;

export namespace registerArkiniElectronIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
		readonly cheatPreferences: CheatPreferences;
		readonly launcherPreferences: LauncherPreferences;
	}
}

/** Registers the narrow Arkini Electron capabilities exposed through preload. */
export const registerArkiniElectronIpcFx = Effect.fn("registerArkiniElectronIpcFx")(
	({
		trustedRenderer,
		appearancePreferences,
		cheatPreferences,
		launcherPreferences,
	}: registerArkiniElectronIpcFx.Props) =>
		Effect.gen(function* () {
			if (registered) return;
			registered = true;
			const userDataPath = app.getPath("userData");
			const arkpacks = yield* createFilesystemArkpackCatalogFx({
				userDataPath,
			});
			const saves = yield* createFilesystemGameSaveFilesFx({
				userDataPath,
			});

			yield* Effect.sync(() => {
				const synchronizeWindowBackgrounds = () => {
					const color = nativeTheme.shouldUseDarkColors ? "#090711" : "#fbf8ff";
					for (const window of BrowserWindow.getAllWindows()) {
						window.setBackgroundColor(color);
					}
				};
				const runAuthorizedFx = <Value, Error>(
					event: IpcMainInvokeEvent,
					operation: Effect.Effect<Value, Error>,
				) =>
					ElectronMainRuntime.runPromise(
						trustedRenderer
							.assertTrustedIpcSenderFx(event)
							.pipe(Effect.zipRight(operation)),
					);

				nativeTheme.on("updated", synchronizeWindowBackgrounds);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceRead, (event) =>
					runAuthorizedFx(
						event,
						Effect.sync(() => nativeTheme.themeSource),
					),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceWrite, (event, theme) =>
					runAuthorizedFx(
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
					runAuthorizedFx(event, appearancePreferences.readAccentFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.appearanceAccentWrite, (event, accent) =>
					runAuthorizedFx(event, appearancePreferences.writeAccentFx(accent)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.cheatAvailabilityRead, (event) =>
					runAuthorizedFx(event, cheatPreferences.readAvailableFx),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.cheatAvailabilityWrite,
					(event, available) =>
						runAuthorizedFx(event, cheatPreferences.writeAvailableFx(available)),
				);
				ipcMain.handle(ArkiniElectronApi.channels.launcherLastPackageIdRead, (event) =>
					runAuthorizedFx(event, launcherPreferences.readLastPackageIdFx),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.launcherLastPackageIdWrite,
					(event, packageId) =>
						runAuthorizedFx(event, launcherPreferences.writeLastPackageIdFx(packageId)),
				);

				ipcMain.handle(ArkiniElectronApi.channels.arkpackList, (event) =>
					runAuthorizedFx(event, arkpacks.listFx),
				);
				ipcMain.handle(ArkiniElectronApi.channels.arkpackRead, (event, packageId: string) =>
					runAuthorizedFx(event, arkpacks.readFx(packageId)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackInstall,
					(event, record: ArkiniElectronApi.ArkpackRecord) =>
						runAuthorizedFx(event, arkpacks.installFx(record)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.arkpackRemove,
					(event, packageId: string) =>
						runAuthorizedFx(event, arkpacks.removeFx(packageId)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveRead,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorizedFx(event, saves.readFx(key)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveWrite,
					(event, key: ArkiniElectronApi.SaveKey, bytes: Uint8Array) =>
						runAuthorizedFx(event, saves.writeFx(key, bytes)),
				);
				ipcMain.handle(
					ArkiniElectronApi.channels.saveClear,
					(event, key: ArkiniElectronApi.SaveKey) =>
						runAuthorizedFx(event, saves.clearFx(key)),
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
						ArkiniElectronApi.channels.saveRead,
						ArkiniElectronApi.channels.saveWrite,
						ArkiniElectronApi.channels.saveClear,
					]) {
						ipcMain.removeHandler(channel);
					}
					registered = false;
				};
				app.once("will-quit", cleanup);
			});
		}),
);
