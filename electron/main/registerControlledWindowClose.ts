import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";

type ControlledCloseIpc = Pick<IpcMain, "on" | "removeListener">;

/** Waits for the renderer's final game flush before allowing one window to close. */
export function registerControlledWindowClose(
	window: BrowserWindow,
	ipc: ControlledCloseIpc,
): void {
	let closeAllowed = false;
	let closeRequested = false;

	const removeListeners = () => {
		ipc.removeListener(ArkiniDesktopApi.channels.closeReady, onCloseReady);
		ipc.removeListener(ArkiniDesktopApi.channels.closeFailed, onCloseFailed);
	};
	const onCloseReady = (event: IpcMainEvent) => {
		if (event.sender.id !== window.webContents.id) return;
		closeAllowed = true;
		removeListeners();
		if (!window.isDestroyed()) window.close();
	};
	const onCloseFailed = (event: IpcMainEvent, message: string) => {
		if (event.sender.id !== window.webContents.id) return;
		closeRequested = false;
		removeListeners();
		console.error("Arkini renderer refused to close after a failed final save:", message);
	};

	window.on("close", (event) => {
		if (closeAllowed || window.webContents.isDestroyed()) return;
		event.preventDefault();
		if (closeRequested) return;
		closeRequested = true;
		ipc.on(ArkiniDesktopApi.channels.closeReady, onCloseReady);
		ipc.on(ArkiniDesktopApi.channels.closeFailed, onCloseFailed);
		window.webContents.send(ArkiniDesktopApi.channels.beforeClose);
	});
	window.webContents.once("render-process-gone", () => {
		closeAllowed = true;
		removeListeners();
		if (!window.isDestroyed()) window.destroy();
	});
	window.once("closed", removeListeners);
}
