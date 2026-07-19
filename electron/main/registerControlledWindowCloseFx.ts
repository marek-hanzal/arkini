import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { Effect } from "effect";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";
import type { TrustedRenderer } from "./security/TrustedRenderer";

type ControlledCloseIpc = Pick<IpcMain, "on" | "removeListener">;

export namespace registerControlledWindowCloseFx {
	export interface Props {
		readonly window: BrowserWindow;
		readonly ipc: ControlledCloseIpc;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Waits for one best-effort renderer final-save attempt before allowing the window to close. */
export const registerControlledWindowCloseFx = Effect.fn("registerControlledWindowCloseFx")(
	({ window, ipc, trustedRenderer }: registerControlledWindowCloseFx.Props) =>
		Effect.sync(() => {
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
			const ownsTrustedWindow = (event: IpcMainEvent) =>
				trustedRenderer.isTrustedIpcSender(event) &&
				event.sender.id === window.webContents.id;
			const onCloseReady = (event: IpcMainEvent) => {
				if (!ownsTrustedWindow(event)) return;
				closeAllowed = true;
				removeAllListeners();
				if (!window.isDestroyed()) window.close();
			};
			const onCloseFailed = (event: IpcMainEvent, message: string) => {
				if (!ownsTrustedWindow(event)) return;
				closeRequested = false;
				removeResponseListeners();
				console.error(
					"Arkini renderer refused to close after a failed final save:",
					message,
				);
			};
			const onRequestClose = (event: IpcMainEvent) => {
				if (!ownsTrustedWindow(event) || window.isDestroyed()) return;
				window.close();
			};
			const onForceClose = (event: IpcMainEvent) => {
				if (!ownsTrustedWindow(event)) return;
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
		}),
);
