import { app, ipcMain } from "electron";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { FilesystemArkpackCatalog } from "./arkpack/FilesystemArkpackCatalog";
import { FilesystemGameSaveRepository } from "./save/FilesystemGameSaveRepository";

let registered = false;

/** Registers the narrow Arkini filesystem capabilities exposed through preload. */
export function registerArkiniDesktopIpc(): void {
	if (registered) return;
	registered = true;
	const userDataPath = app.getPath("userData");
	const arkpacks = new FilesystemArkpackCatalog(userDataPath);
	const saves = new FilesystemGameSaveRepository(userDataPath);

	ipcMain.handle(ArkiniDesktopApi.channels.arkpackList, () => arkpacks.list());
	ipcMain.handle(ArkiniDesktopApi.channels.arkpackRead, (_event, packageId: string) =>
		arkpacks.read(packageId),
	);
	ipcMain.handle(
		ArkiniDesktopApi.channels.arkpackInstall,
		(_event, record: ArkiniDesktopApi.ArkpackRecord) => arkpacks.install(record),
	);
	ipcMain.handle(ArkiniDesktopApi.channels.arkpackRemove, (_event, packageId: string) =>
		arkpacks.remove(packageId),
	);
	ipcMain.handle(ArkiniDesktopApi.channels.saveRead, (_event, key: ArkiniDesktopApi.SaveKey) =>
		saves.read(key),
	);
	ipcMain.handle(
		ArkiniDesktopApi.channels.saveWrite,
		(_event, key: ArkiniDesktopApi.SaveKey, bytes: Uint8Array) => saves.write(key, bytes),
	);
	ipcMain.handle(ArkiniDesktopApi.channels.saveClear, (_event, key: ArkiniDesktopApi.SaveKey) =>
		saves.clear(key),
	);
}
