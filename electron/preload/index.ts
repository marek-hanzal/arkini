import { contextBridge, ipcRenderer } from "electron";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
const beforeCloseReadyListeners = new Set<() => Promise<void>>();
const closeFailedListeners = new Set<(error: unknown) => void>();
const chatGptStateListeners = new Set<
	Parameters<ArkiniElectronApi.Api["chatGpt"]["onStateChanged"]>[0]
>();
const chatGptAssetCandidateListeners = new Set<
	Parameters<ArkiniElectronApi.Api["chatGpt"]["onAssetCandidate"]>[0]
>();
const editorProjectChangedListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editor"]["onProjectChanged"]>[0]
>();
const editorMcpVersionCheckoutListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editorMcp"]["onVersionCheckoutRequested"]>[0]
>();
const editorMcpOverviewListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editorMcp"]["onOverviewChanged"]>[0]
>();
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

ipcRenderer.on(ArkiniElectronApi.channels.editorProjectChanged, (_event, projectId) => {
	for (const listener of Array.from(editorProjectChangedListeners)) listener(projectId);
});

ipcRenderer.on(ArkiniElectronApi.channels.editorMcpOverviewChanged, (_event, overview) => {
	for (const listener of Array.from(editorMcpOverviewListeners)) listener(overview);
});

ipcRenderer.on(ArkiniElectronApi.channels.chatGptStateChanged, (_event, state) => {
	for (const listener of Array.from(chatGptStateListeners)) listener(state);
});

ipcRenderer.on(ArkiniElectronApi.channels.chatGptAssetCandidate, (_event, candidate) => {
	for (const listener of Array.from(chatGptAssetCandidateListeners)) listener(candidate);
});

ipcRenderer.on(
	ArkiniElectronApi.channels.editorMcpVersionCheckoutRequest,
	async (event, request) => {
		const port = event.ports[0];
		if (port === undefined) return;
		let response: ArkiniElectronApi.EditorMcpVersionCheckoutResponse;
		try {
			const listeners = Array.from(editorMcpVersionCheckoutListeners);
			if (listeners.length !== 1)
				throw new Error("The editor version checkout handler is unavailable.");
			await listeners[0](request);
			response = {
				type: "success",
			};
		} catch (cause) {
			response = {
				type: "failure",
				message: cause instanceof Error ? cause.message : String(cause),
			};
		}
		port.postMessage(response);
		port.close();
	},
);

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
	chatGpt: {
		setSurface: (surface) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.chatGptSurfaceSet, surface),
		onStateChanged: (listener) => {
			chatGptStateListeners.add(listener);
			return () => chatGptStateListeners.delete(listener);
		},
		onAssetCandidate: (listener) => {
			chatGptAssetCandidateListeners.add(listener);
			return () => chatGptAssetCandidateListeners.delete(listener);
		},
	},
	clipboard: {
		writeText: (text) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.clipboardWriteText, text),
	},
	cli: {
		status: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliStatus),
		install: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliInstall),
		replace: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliReplace),
		uninstall: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliUninstall),
		completion: {
			status: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionStatus),
			install: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionInstall),
			replace: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionReplace),
			uninstall: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionUninstall),
		},
	},
	launcher: {
		readLastPackageId: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead),
		writeLastPackageId: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdWrite, packageId),
	},
	editor: {
		buildProject: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuild, request),
		readProjectBuild: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuildRead, request),
		saveProjectBuild: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuildSave, request),
		status: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorStatus),
		awaitIdle: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorAwaitIdle),
		createProject: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectCreate, request),
		deleteProject: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDelete, projectId),
		deleteItem: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDeleteItem, request),
		deleteResource: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDeleteResource, request),
		exportJsonDirectory: (projectId) =>
			ipcRenderer.invoke(
				ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
				projectId,
			),
		importJsonDirectory: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectImportJsonDirectory),
		listProjects: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectList),
		openExportDirectory: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectOpenExportDirectory),
		openProjectDirectory: (root) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectOpenDirectory, root),
		readProject: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectRead, projectId),
		refreshProject: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectRefresh, projectId),
		onProjectChanged: (listener) => {
			editorProjectChangedListeners.add(listener);
			return () => editorProjectChangedListeners.delete(listener);
		},
		replaceConfig: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, request),
		replaceResource: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceResource, request),
		saveResource: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectSaveResource, request),
		upsertItem: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, request),
		upsertResources: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertResources, request),
		listNotes: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteList, projectId),
		createNote: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteCreate, request),
		updateNote: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteUpdate, request),
		deleteNote: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteDelete, request),
		listBoardScenarios: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioList, projectId),
		readBoardScenario: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioRead, request),
		writeBoardScenario: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioWrite, request),
		deleteBoardScenario: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioDelete, request),
		readVersionStatus: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionStatus, projectId),
		listVersions: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionList, projectId),
		diffVersions: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionDiff, request),
		createVersion: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionCommit, request),
		checkoutVersion: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionCheckout, request),
		updateVersionTag: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionTag, request),
	},
	editorMcp: {
		readOverview: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpOverviewRead),
		configure: (configuration) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpConfigure, configuration),
		command: (command) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpCommand, command),
		onOverviewChanged: (listener) => {
			editorMcpOverviewListeners.add(listener);
			return () => editorMcpOverviewListeners.delete(listener);
		},
		setProjectContext: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextSet, projectId),
		clearProjectContext: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextClear, projectId),
		onVersionCheckoutRequested: (listener) => {
			editorMcpVersionCheckoutListeners.add(listener);
			return () => editorMcpVersionCheckoutListeners.delete(listener);
		},
	},
	arkpack: {
		list: () => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackList),
		read: (packageId) => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRead, packageId),
		install: (record) => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackInstall, record),
		remove: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRemove, packageId),
		openUserDirectory: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackOpenUserDirectory),
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
	userData: {
		openDirectory: () => ipcRenderer.invoke(ArkiniElectronApi.channels.userDataOpenDirectory),
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
