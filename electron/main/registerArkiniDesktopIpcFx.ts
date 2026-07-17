import { app, BrowserWindow, ipcMain, nativeTheme, type IpcMainInvokeEvent } from "electron";
import { Effect } from "effect";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { FilesystemArkpackCatalog } from "./arkpack/FilesystemArkpackCatalog";
import { writeAppearanceThemeFx } from "./appearance/writeAppearanceThemeFx";
import { FilesystemGameSaveRepository } from "./save/FilesystemGameSaveRepository";
import type { TrustedRenderer } from "./security/TrustedRenderer";

let registered = false;

export namespace registerArkiniDesktopIpcFx {
	export interface Props {
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Registers the narrow Arkini desktop capabilities exposed through preload. */
export const registerArkiniDesktopIpcFx = Effect.fn("registerArkiniDesktopIpcFx")(
	({ trustedRenderer }: registerArkiniDesktopIpcFx.Props) =>
		Effect.sync(() => {
			if (registered) return;
			registered = true;
			const userDataPath = app.getPath("userData");
			const arkpacks = new FilesystemArkpackCatalog(userDataPath);
			const saves = new FilesystemGameSaveRepository(userDataPath);
			const synchronizeWindowBackgrounds = () => {
				const color = nativeTheme.shouldUseDarkColors ? "#090711" : "#fbf8ff";
				for (const window of BrowserWindow.getAllWindows())
					window.setBackgroundColor(color);
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
			const runAuthorizedPromise = <Value>(
				event: IpcMainInvokeEvent,
				operation: () => Promise<Value>,
			) =>
				runAuthorizedFx(
					event,
					Effect.tryPromise({
						try: operation,
						catch: (cause) => cause,
					}),
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
					writeAppearanceThemeFx({
						userDataPath,
						theme,
					}).pipe(
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
				runAuthorizedPromise(event, () => arkpacks.list()),
			);
			ipcMain.handle(ArkiniDesktopApi.channels.arkpackRead, (event, packageId: string) =>
				runAuthorizedPromise(event, () => arkpacks.read(packageId)),
			);
			ipcMain.handle(
				ArkiniDesktopApi.channels.arkpackInstall,
				(event, record: ArkiniDesktopApi.ArkpackRecord) =>
					runAuthorizedPromise(event, () => arkpacks.install(record)),
			);
			ipcMain.handle(ArkiniDesktopApi.channels.arkpackRemove, (event, packageId: string) =>
				runAuthorizedPromise(event, () => arkpacks.remove(packageId)),
			);
			ipcMain.handle(
				ArkiniDesktopApi.channels.saveRead,
				(event, key: ArkiniDesktopApi.SaveKey) =>
					runAuthorizedPromise(event, () => saves.read(key)),
			);
			ipcMain.handle(
				ArkiniDesktopApi.channels.saveWrite,
				(event, key: ArkiniDesktopApi.SaveKey, bytes: Uint8Array) =>
					runAuthorizedPromise(event, () => saves.write(key, bytes)),
			);
			ipcMain.handle(
				ArkiniDesktopApi.channels.saveClear,
				(event, key: ArkiniDesktopApi.SaveKey) =>
					runAuthorizedPromise(event, () => saves.clear(key)),
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
		}),
);
