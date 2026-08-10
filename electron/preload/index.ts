import { contextBridge, ipcRenderer } from "electron";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
const beforeCloseReadyListeners = new Set<() => Promise<void>>();
const closeFailedListeners = new Set<(error: unknown) => void>();
const windowModeListeners = new Set<
	Parameters<ArkiniElectronApi.Api["window"]["onModeChanged"]>[0]
>();
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

ipcRenderer.on(ArkiniElectronApi.channels.windowVisible, () => {
	if (visibleAtMs !== undefined) return;
	visibleAtMs = performance.now();
	resolveVisible(visibleAtMs);
});

ipcRenderer.on(ArkiniElectronApi.channels.windowModeChanged, (_event, mode) => {
	for (const listener of Array.from(windowModeListeners)) listener(mode);
});

ipcRenderer.on(ArkiniElectronApi.channels.beforeClose, async () => {
	if (closing) return;
	closing = true;
	try {
		await Promise.all(Array.from(beforeCloseListeners, (listener) => listener()));
		await Promise.all(Array.from(beforeCloseReadyListeners, (listener) => listener()));
		requestedClose?.resolve();
		requestedClose = undefined;
		ipcRenderer.send(ArkiniElectronApi.channels.closeReady);
	} catch (error) {
		closing = false;
		for (const listener of Array.from(closeFailedListeners)) listener(error);
		ipcRenderer.send(ArkiniElectronApi.channels.closeFailed, String(error));
		requestedClose?.reject(error);
		requestedClose = undefined;
	}
});

const api: ArkiniElectronApi.Api = {
	appearance: {
		read: () => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceRead),
		write: (theme) => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceWrite, theme),
		readAccent: () => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceAccentRead),
		writeAccent: (accent) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceAccentWrite, accent),
	},
	cheats: {
		readAvailable: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cheatAvailabilityRead),
		writeAvailable: (available) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.cheatAvailabilityWrite, available),
	},
	launcher: {
		readLastPackageId: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead),
		writeLastPackageId: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdWrite, packageId),
	},
	editor: {
		status: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorStatus),
		awaitIdle: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorAwaitIdle),
		createProject: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectCreate, request),
		listProjects: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectList),
		readProject: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectRead, projectId),
		replaceConfig: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, request),
		replaceResource: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceResource, request),
		upsertItem: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, request),
		upsertResources: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertResources, request),
	},
	editorMcp: {
		status: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpStatus),
		activate: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpActivate),
		setProjectContext: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextSet, projectId),
		clearProjectContext: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextClear, projectId),
		readPort: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpPortRead),
		writePort: (port) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpPortWrite, port),
		checkPort: (port) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpPortCheck, port),
	},
	arkpack: {
		list: () => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackList),
		read: (packageId) => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRead, packageId),
		install: (record) => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackInstall, record),
		remove: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRemove, packageId),
	},
	save: {
		read: (key) => ipcRenderer.invoke(ArkiniElectronApi.channels.saveRead, key),
		write: (key, bytes) => ipcRenderer.invoke(ArkiniElectronApi.channels.saveWrite, key, bytes),
		clear: (key) => ipcRenderer.invoke(ArkiniElectronApi.channels.saveClear, key),
	},
	diagnostics: {
		write: (record) => ipcRenderer.invoke(ArkiniElectronApi.channels.diagnosticsWrite, record),
		openDirectory: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.diagnosticsOpenDirectory),
	},
	window: {
		readMode: () => ipcRenderer.invoke(ArkiniElectronApi.channels.windowModeRead),
		writeMode: (mode) => ipcRenderer.invoke(ArkiniElectronApi.channels.windowModeWrite, mode),
		onModeChanged: (listener) => {
			windowModeListeners.add(listener);
			return () => windowModeListeners.delete(listener);
		},
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
			ipcRenderer.send(ArkiniElectronApi.channels.requestClose);
			return promise;
		},
		forceClose: () => ipcRenderer.send(ArkiniElectronApi.channels.forceClose),
	},
};

contextBridge.exposeInMainWorld("arkini", api);
