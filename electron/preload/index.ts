import { contextBridge, ipcRenderer } from "electron";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
let closing = false;
let requestedClose:
	| {
			readonly promise: Promise<void>;
			readonly reject: (error: unknown) => void;
	  }
	| undefined;

ipcRenderer.on(ArkiniDesktopApi.channels.beforeClose, async () => {
	if (closing) return;
	closing = true;
	try {
		await Promise.all(Array.from(beforeCloseListeners, (listener) => listener()));
		ipcRenderer.send(ArkiniDesktopApi.channels.closeReady);
	} catch (error) {
		closing = false;
		ipcRenderer.send(ArkiniDesktopApi.channels.closeFailed, String(error));
		requestedClose?.reject(error);
		requestedClose = undefined;
	}
});

const api: ArkiniDesktopApi.Api = {
	appearance: {
		read: () => ipcRenderer.invoke(ArkiniDesktopApi.channels.appearanceRead),
		write: (theme) => ipcRenderer.invoke(ArkiniDesktopApi.channels.appearanceWrite, theme),
		readAccent: () => ipcRenderer.invoke(ArkiniDesktopApi.channels.appearanceAccentRead),
		writeAccent: (accent) =>
			ipcRenderer.invoke(ArkiniDesktopApi.channels.appearanceAccentWrite, accent),
	},
	arkpack: {
		list: () => ipcRenderer.invoke(ArkiniDesktopApi.channels.arkpackList),
		read: (packageId) => ipcRenderer.invoke(ArkiniDesktopApi.channels.arkpackRead, packageId),
		install: (record) => ipcRenderer.invoke(ArkiniDesktopApi.channels.arkpackInstall, record),
		remove: (packageId) =>
			ipcRenderer.invoke(ArkiniDesktopApi.channels.arkpackRemove, packageId),
	},
	save: {
		read: (key) => ipcRenderer.invoke(ArkiniDesktopApi.channels.saveRead, key),
		write: (key, bytes) => ipcRenderer.invoke(ArkiniDesktopApi.channels.saveWrite, key, bytes),
		clear: (key) => ipcRenderer.invoke(ArkiniDesktopApi.channels.saveClear, key),
	},
	lifecycle: {
		onBeforeClose: (listener) => {
			beforeCloseListeners.add(listener);
			return () => beforeCloseListeners.delete(listener);
		},
		requestClose: () => {
			if (requestedClose !== undefined) return requestedClose.promise;
			let rejectRequest: (error: unknown) => void = () => undefined;
			const promise = new Promise<void>((_resolve, reject) => {
				rejectRequest = reject;
			});
			requestedClose = {
				promise,
				reject: rejectRequest,
			};
			ipcRenderer.send(ArkiniDesktopApi.channels.requestClose);
			return promise;
		},
		forceClose: () => ipcRenderer.send(ArkiniDesktopApi.channels.forceClose),
	},
};

contextBridge.exposeInMainWorld("arkini", api);
