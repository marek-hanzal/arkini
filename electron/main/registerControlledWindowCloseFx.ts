import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { Effect } from "effect";
import { SerakkiElectronApi } from "../contract/SerakkiElectronApi";
import type { TrustedRenderer } from "./security/TrustedRenderer";

type ControlledCloseIpc = Pick<IpcMain, "on" | "removeListener">;

export namespace registerControlledWindowCloseFx {
	export interface Props {
		readonly window: BrowserWindow;
		readonly ipc: ControlledCloseIpc;
		readonly trustedRenderer: TrustedRenderer;
	}
}

/** Holds native close until the renderer completes its trusted shutdown choreography. */
export const registerControlledWindowCloseFx = Effect.fn("registerControlledWindowCloseFx")(
	({ window, ipc, trustedRenderer }: registerControlledWindowCloseFx.Props) =>
		Effect.sync(() => {
			let closeAllowed = false;
			let closeRequested = false;

			const removeResponseListenersFn = () => {
				ipc.removeListener(SerakkiElectronApi.channels.closeReady, onCloseReadyFn);
				ipc.removeListener(SerakkiElectronApi.channels.closeFailed, onCloseFailedFn);
			};
			const removeAllListenersFn = () => {
				removeResponseListenersFn();
				ipc.removeListener(SerakkiElectronApi.channels.requestClose, onRequestCloseFn);
				ipc.removeListener(SerakkiElectronApi.channels.forceClose, onForceCloseFn);
			};
			const ownsTrustedWindowFn = (event: IpcMainEvent) =>
				trustedRenderer.isTrustedIpcSenderFn(event) &&
				event.sender.id === window.webContents.id;
			const onCloseReadyFn = (event: IpcMainEvent) => {
				if (!ownsTrustedWindowFn(event)) return;
				closeAllowed = true;
				removeAllListenersFn();
				if (!window.isDestroyed()) window.close();
			};
			const onCloseFailedFn = (event: IpcMainEvent, message: string) => {
				if (!ownsTrustedWindowFn(event)) return;
				closeRequested = false;
				removeResponseListenersFn();
				console.error("Serakki renderer controlled-close orchestration failed:", message);
			};
			const onRequestCloseFn = (event: IpcMainEvent) => {
				if (!ownsTrustedWindowFn(event) || window.isDestroyed()) return;
				window.close();
			};
			const onForceCloseFn = (event: IpcMainEvent) => {
				if (!ownsTrustedWindowFn(event)) return;
				closeAllowed = true;
				removeAllListenersFn();
				if (!window.isDestroyed()) window.close();
			};

			ipc.on(SerakkiElectronApi.channels.requestClose, onRequestCloseFn);
			ipc.on(SerakkiElectronApi.channels.forceClose, onForceCloseFn);
			window.on("close", (event) => {
				if (closeAllowed || window.webContents.isDestroyed()) return;
				event.preventDefault();
				if (closeRequested) return;
				closeRequested = true;
				ipc.on(SerakkiElectronApi.channels.closeReady, onCloseReadyFn);
				ipc.on(SerakkiElectronApi.channels.closeFailed, onCloseFailedFn);
				window.webContents.send(SerakkiElectronApi.channels.beforeClose);
			});
			window.webContents.once("render-process-gone", () => {
				closeAllowed = true;
				removeAllListenersFn();
				if (!window.isDestroyed()) window.destroy();
			});
			window.once("closed", removeAllListenersFn);
		}),
);
