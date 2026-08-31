import type { BrowserWindow, IpcMain, IpcMainEvent } from "electron";
import { Effect } from "effect";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";
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
				ipc.removeListener(ArkiniElectronApi.channels.closeReady, onCloseReadyFn);
				ipc.removeListener(ArkiniElectronApi.channels.closeFailed, onCloseFailedFn);
			};
			const removeAllListenersFn = () => {
				removeResponseListenersFn();
				ipc.removeListener(ArkiniElectronApi.channels.requestClose, onRequestCloseFn);
				ipc.removeListener(ArkiniElectronApi.channels.forceClose, onForceCloseFn);
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
				console.error("Arkini renderer controlled-close orchestration failed:", message);
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

			ipc.on(ArkiniElectronApi.channels.requestClose, onRequestCloseFn);
			ipc.on(ArkiniElectronApi.channels.forceClose, onForceCloseFn);
			window.on("close", (event) => {
				if (closeAllowed || window.webContents.isDestroyed()) return;
				event.preventDefault();
				if (closeRequested) return;
				closeRequested = true;
				ipc.on(ArkiniElectronApi.channels.closeReady, onCloseReadyFn);
				ipc.on(ArkiniElectronApi.channels.closeFailed, onCloseFailedFn);
				window.webContents.send(ArkiniElectronApi.channels.beforeClose);
			});
			window.webContents.once("render-process-gone", () => {
				closeAllowed = true;
				removeAllListenersFn();
				if (!window.isDestroyed()) window.destroy();
			});
			window.once("closed", removeAllListenersFn);
		}),
);
