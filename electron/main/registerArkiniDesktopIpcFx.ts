import { app, BrowserWindow, ipcMain, nativeTheme, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { createFilesystemArkpackCatalogFx } from "./arkpack/createFilesystemArkpackCatalogFx";
import type { AppearancePreferences } from "./appearance/AppearancePreferences";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { createFilesystemGameSaveFilesFx } from "./save/createFilesystemGameSaveFilesFx";
import type { TrustedRenderer } from "./security/TrustedRenderer";

let registered = false;

export namespace registerArkiniDesktopIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
		readonly appearancePreferences: AppearancePreferences;
	}
}

/** Registers the narrow Arkini desktop capabilities exposed through preload. */
export const registerArkiniDesktopIpcFx = Effect.fn("registerArkiniDesktopIpcFx")(
	({ trustedRenderer, appearancePreferences }: registerArkiniDesktopIpcFx.Props) =>
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
				ipcMain.handle(ArkiniDesktopApi.channels.appearanceRead, (event) =>
					runAuthorizedFx(
						event,
						Effect.sync(() => nativeTheme.themeSource),
					),
				);
				ipcMain.handle(ArkiniDesktopApi.channels.appearanceWrite, (event, theme) =>
					runAuthorizedFx(
						event,
						appearancePreferences.writeFx(theme).pipe(
							Effect.tap(() =>
								Effect.sync(() => {
									nativeTheme.themeSource = theme;
									synchronizeWindowBackgrounds();
								}),
							),
						),
					),
				);

				ipcMain.handle(ArkiniDesktopApi.channels.arkpackList, (event) =>
					runAuthorizedFx(event, arkpacks.listFx),
				);
				ipcMain.handle(ArkiniDesktopApi.channels.arkpackRead, (event, packageId: string) =>
					runAuthorizedFx(event, arkpacks.readFx(packageId)),
				);
				ipcMain.handle(
					ArkiniDesktopApi.channels.arkpackInstall,
					(event, record: ArkiniDesktopApi.ArkpackRecord) =>
						runAuthorizedFx(event, arkpacks.installFx(record)),
				);
				ipcMain.handle(
					ArkiniDesktopApi.channels.arkpackRemove,
					(event, packageId: string) =>
						runAuthorizedFx(event, arkpacks.removeFx(packageId)),
				);
				ipcMain.handle(
					ArkiniDesktopApi.channels.saveRead,
					(event, key: ArkiniDesktopApi.SaveKey) =>
						runAuthorizedFx(event, saves.readFx(key)),
				);
				ipcMain.handle(
					ArkiniDesktopApi.channels.saveWrite,
					(event, key: ArkiniDesktopApi.SaveKey, bytes: Uint8Array) =>
						runAuthorizedFx(event, saves.writeFx(key, bytes)),
				);
				ipcMain.handle(
					ArkiniDesktopApi.channels.saveClear,
					(event, key: ArkiniDesktopApi.SaveKey) =>
						runAuthorizedFx(event, saves.clearFx(key)),
				);

				const cleanup = () => {
					nativeTheme.removeListener("updated", synchronizeWindowBackgrounds);
					for (const channel of [
						ArkiniDesktopApi.channels.appearanceRead,
						ArkiniDesktopApi.channels.appearanceWrite,
						ArkiniDesktopApi.channels.arkpackList,
						ArkiniDesktopApi.channels.arkpackRead,
						ArkiniDesktopApi.channels.arkpackInstall,
						ArkiniDesktopApi.channels.arkpackRemove,
						ArkiniDesktopApi.channels.saveRead,
						ArkiniDesktopApi.channels.saveWrite,
						ArkiniDesktopApi.channels.saveClear,
					]) {
						ipcMain.removeHandler(channel);
					}
					registered = false;
				};
				app.once("will-quit", cleanup);
			});
		}),
);
