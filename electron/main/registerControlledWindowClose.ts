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

	const removeResponseListeners = () => {
		ipc.removeListener(ArkiniDesktopApi.channels.closeReady, onCloseReady);
		ipc.removeListener(ArkiniDesktopApi.channels.closeFailed, onCloseFailed);
	};
	const removeAllListeners = () => {
		removeResponseListeners();
		ipc.removeListener(ArkiniDesktopApi.channels.requestClose, onRequestClose);
		ipc.removeListener(ArkiniDesktopApi.channels.forceClose, onForceClose);
	};
	const ownsWindow = (event: IpcMainEvent) => event.sender.id === window.webContents.id;
	const onCloseReady = (event: IpcMainEvent) => {
		if (!ownsWindow(event)) return;
		closeAllowed = true;
		removeAllListeners();
		if (!window.isDestroyed()) window.close();
	};
	const onCloseFailed = (event: IpcMainEvent, message: string) => {
		if (!ownsWindow(event)) return;
		closeRequested = false;
		removeResponseListeners();
		console.error("Arkini renderer refused to close after a failed final save:", message);
	};
	const onRequestClose = (event: IpcMainEvent) => {
		if (!ownsWindow(event) || window.isDestroyed()) return;
		window.close();
	};
	const onForceClose = (event: IpcMainEvent) => {
		if (!ownsWindow(event)) return;
		closeAllowed = true;
		removeAllListeners();
		if (!window.isDestroyed()) window.close();
	};

	ipc.on(ArkiniDesktopApi.channels.requestClose, onRequestClose);
	ipc.on(ArkiniDesktopApi.channels.forceClose, onForceClose);
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
		removeAllListeners();
		if (!window.isDestroyed()) window.destroy();
	});
	window.once("closed", removeAllListeners);
}
