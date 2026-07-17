import { app, ipcMain } from "electron";
import { Effect } from "effect";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import { ElectronMainRuntime } from "./ElectronMainRuntime";
import { FilesystemArkpackCatalog } from "./arkpack/FilesystemArkpackCatalog";
import { FilesystemGameSaveRepository } from "./save/FilesystemGameSaveRepository";

let registered = false;

const runPromise = <Value>(operation: () => Promise<Value>) =>
	ElectronMainRuntime.runPromise(
		Effect.tryPromise({
			try: operation,
			catch: (cause) => cause,
		}),
	);

/** Registers the narrow Arkini filesystem capabilities exposed through preload. */
export const registerArkiniDesktopIpcFx = Effect.fn("registerArkiniDesktopIpcFx")(() =>
	Effect.sync(() => {
		if (registered) return;
		registered = true;
		const userDataPath = app.getPath("userData");
		const arkpacks = new FilesystemArkpackCatalog(userDataPath);
		const saves = new FilesystemGameSaveRepository(userDataPath);

		ipcMain.handle(ArkiniDesktopApi.channels.arkpackList, () =>
			runPromise(() => arkpacks.list()),
		);
		ipcMain.handle(ArkiniDesktopApi.channels.arkpackRead, (_event, packageId: string) =>
			runPromise(() => arkpacks.read(packageId)),
		);
		ipcMain.handle(
			ArkiniDesktopApi.channels.arkpackInstall,
			(_event, record: ArkiniDesktopApi.ArkpackRecord) =>
				runPromise(() => arkpacks.install(record)),
		);
		ipcMain.handle(ArkiniDesktopApi.channels.arkpackRemove, (_event, packageId: string) =>
			runPromise(() => arkpacks.remove(packageId)),
		);
		ipcMain.handle(
			ArkiniDesktopApi.channels.saveRead,
			(_event, key: ArkiniDesktopApi.SaveKey) => runPromise(() => saves.read(key)),
		);
		ipcMain.handle(
			ArkiniDesktopApi.channels.saveWrite,
			(_event, key: ArkiniDesktopApi.SaveKey, bytes: Uint8Array) =>
				runPromise(() => saves.write(key, bytes)),
		);
		ipcMain.handle(
			ArkiniDesktopApi.channels.saveClear,
			(_event, key: ArkiniDesktopApi.SaveKey) => runPromise(() => saves.clear(key)),
		);
	}),
);
