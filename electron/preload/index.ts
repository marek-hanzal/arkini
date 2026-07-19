import { contextBridge, ipcRenderer } from "electron";
import { ArkiniDesktopApi } from "../../desktop/ArkiniDesktopApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
const beforeCloseReadyListeners = new Set<() => Promise<void>>();
const closeFailedListeners = new Set<(error: unknown) => void>();
let closing = false;
let requestedClose:
	| {
			readonly promise: Promise<void>;
			readonly resolve: () => void;
			readonly reject: (error: unknown) => void;
	  }
	| undefined;
let visibleAtMs: number | undefined;
let resolveVisible!: (visibleAtMs: number) => void;
const visiblePromise = new Promise<number>((resolve) => {
	resolveVisible = resolve;
});

ipcRenderer.on(ArkiniDesktopApi.channels.windowVisible, () => {
	if (visibleAtMs !== undefined) return;
	visibleAtMs = performance.now();
	resolveVisible(visibleAtMs);
});

ipcRenderer.on(ArkiniDesktopApi.channels.beforeClose, async () => {
	if (closing) return;
	closing = true;
	try {
		await Promise.all(Array.from(beforeCloseListeners, (listener) => listener()));
		await Promise.all(Array.from(beforeCloseReadyListeners, (listener) => listener()));
		requestedClose?.resolve();
		requestedClose = undefined;
		ipcRenderer.send(ArkiniDesktopApi.channels.closeReady);
	} catch (error) {
		closing = false;
		for (const listener of Array.from(closeFailedListeners)) listener(error);
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
		waitUntilVisible: () => visiblePromise,
		onBeforeClose: (listener) => {
			beforeCloseListeners.add(listener);
			return () => beforeCloseListeners.delete(listener);
		},
		onBeforeCloseReady: (listener) => {
			beforeCloseReadyListeners.add(listener);
			return () => beforeCloseReadyListeners.delete(listener);
		},
		onCloseFailed: (listener) => {
			closeFailedListeners.add(listener);
			return () => closeFailedListeners.delete(listener);
		},
		requestClose: () => {
			if (requestedClose !== undefined) return requestedClose.promise;
			let resolveRequest: () => void = () => undefined;
			let rejectRequest: (error: unknown) => void = () => undefined;
			const promise = new Promise<void>((resolve, reject) => {
				resolveRequest = resolve;
				rejectRequest = reject;
			});
			requestedClose = {
				promise,
				resolve: resolveRequest,
				reject: rejectRequest,
			};
			ipcRenderer.send(ArkiniDesktopApi.channels.requestClose);
			return promise;
		},
		forceClose: () => ipcRenderer.send(ArkiniDesktopApi.channels.forceClose),
	},
};

contextBridge.exposeInMainWorld("arkini", api);
