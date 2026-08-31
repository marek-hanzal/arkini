import { contextBridge, ipcRenderer } from "electron";
import { ArkiniElectronApi } from "../contract/ArkiniElectronApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
const beforeCloseReadyListeners = new Set<() => Promise<void>>();
const closeFailedListeners = new Set<(error: unknown) => void>();
const chatGptStateListeners = new Set<
	Parameters<ArkiniElectronApi.Api["chatGpt"]["onStateChangedFn"]>[0]
>();
const chatGptAssetCandidateListeners = new Set<
	Parameters<ArkiniElectronApi.Api["chatGpt"]["onAssetCandidateFn"]>[0]
>();
const editorProjectChangedListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editor"]["onProjectChangedFn"]>[0]
>();
const editorMcpVersionCheckoutListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editorMcp"]["onVersionCheckoutRequestedFn"]>[0]
>();
const editorMcpOverviewListeners = new Set<
	Parameters<ArkiniElectronApi.Api["editorMcp"]["onOverviewChangedFn"]>[0]
>();
const windowModeListeners = new Set<
	Parameters<ArkiniElectronApi.Api["window"]["onModeChangedFn"]>[0]
>();
let closing = false;
let requestedClose:
	| {
			readonly promise: Promise<void>;
			readonly resolveFn: () => void;
			readonly rejectFn: (error: unknown) => void;
	  }
	| undefined;
let visibleAtMs: number | undefined;
let resolveVisibleFn!: (visibleAtMs: number) => void;
const visiblePromise = new Promise<number>((resolveFn) => {
	resolveVisibleFn = resolveFn;
});

ipcRenderer.on(ArkiniElectronApi.channels.windowVisible, () => {
	if (visibleAtMs !== undefined) return;
	visibleAtMs = performance.now();
	resolveVisibleFn(visibleAtMs);
});

ipcRenderer.on(ArkiniElectronApi.channels.windowModeChanged, (_event, mode) => {
	for (const listenerFn of Array.from(windowModeListeners)) listenerFn(mode);
});

ipcRenderer.on(ArkiniElectronApi.channels.editorProjectChanged, (_event, projectId) => {
	for (const listenerFn of Array.from(editorProjectChangedListeners)) listenerFn(projectId);
});

ipcRenderer.on(ArkiniElectronApi.channels.editorMcpOverviewChanged, (_event, overview) => {
	for (const listenerFn of Array.from(editorMcpOverviewListeners)) listenerFn(overview);
});

ipcRenderer.on(ArkiniElectronApi.channels.chatGptStateChanged, (_event, state) => {
	for (const listenerFn of Array.from(chatGptStateListeners)) listenerFn(state);
});

ipcRenderer.on(ArkiniElectronApi.channels.chatGptAssetCandidate, (_event, candidate) => {
	for (const listenerFn of Array.from(chatGptAssetCandidateListeners)) listenerFn(candidate);
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
		await Promise.all(Array.from(beforeCloseListeners, (listenerFn) => listenerFn()));
		await Promise.all(Array.from(beforeCloseReadyListeners, (listenerFn) => listenerFn()));
		requestedClose?.resolveFn();
		requestedClose = undefined;
		ipcRenderer.send(ArkiniElectronApi.channels.closeReady);
	} catch (error) {
		closing = false;
		for (const listenerFn of Array.from(closeFailedListeners)) listenerFn(error);
		ipcRenderer.send(ArkiniElectronApi.channels.closeFailed, String(error));
		requestedClose?.rejectFn(error);
		requestedClose = undefined;
	}
});

const api: ArkiniElectronApi.Api = {
	appearance: {
		readFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceRead),
		writeFn: (theme) => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceWrite, theme),
		readAccentFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceAccentRead),
		writeAccentFn: (accent) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.appearanceAccentWrite, accent),
	},
	cheats: {
		readAvailableFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cheatAvailabilityRead),
		writeAvailableFn: (available) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.cheatAvailabilityWrite, available),
	},
	chatGpt: {
		setSurfaceFn: (surface) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.chatGptSurfaceSet, surface),
		onStateChangedFn: (listenerFn) => {
			chatGptStateListeners.add(listenerFn);
			return () => chatGptStateListeners.delete(listenerFn);
		},
		onAssetCandidateFn: (listenerFn) => {
			chatGptAssetCandidateListeners.add(listenerFn);
			return () => chatGptAssetCandidateListeners.delete(listenerFn);
		},
	},
	clipboard: {
		writeTextFn: (text) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.clipboardWriteText, text),
	},
	cli: {
		statusFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliStatus),
		installFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliInstall),
		replaceFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliReplace),
		uninstallFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliUninstall),
		completion: {
			statusFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionStatus),
			installFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionInstall),
			replaceFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionReplace),
			uninstallFn: () =>
				ipcRenderer.invoke(ArkiniElectronApi.channels.cliCompletionUninstall),
		},
	},
	launcher: {
		readLastPackageIdFn: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdRead),
		writeLastPackageIdFn: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.launcherLastPackageIdWrite, packageId),
	},
	editor: {
		buildProjectFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuild, request),
		readProjectBuildFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuildRead, request),
		saveProjectBuildFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectBuildSave, request),
		statusFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorStatus),
		awaitIdleFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorAwaitIdle),
		createProjectFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectCreate, request),
		deleteProjectFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDelete, projectId),
		deleteItemFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDeleteItem, request),
		deleteResourceFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectDeleteResource, request),
		exportJsonDirectoryFn: (projectId) =>
			ipcRenderer.invoke(
				ArkiniElectronApi.channels.editorProjectExportJsonDirectory,
				projectId,
			),
		importJsonDirectoryFn: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectImportJsonDirectory),
		listProjectsFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectList),
		openExportDirectoryFn: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectOpenExportDirectory),
		openProjectDirectoryFn: (root) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectOpenDirectory, root),
		readProjectFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectRead, projectId),
		refreshProjectFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectRefresh, projectId),
		onProjectChangedFn: (listenerFn) => {
			editorProjectChangedListeners.add(listenerFn);
			return () => editorProjectChangedListeners.delete(listenerFn);
		},
		replaceConfigFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceConfig, request),
		replaceResourceFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectReplaceResource, request),
		saveResourceFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectSaveResource, request),
		upsertItemFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertItem, request),
		upsertResourcesFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorProjectUpsertResources, request),
		listNotesFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteList, projectId),
		createNoteFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteCreate, request),
		updateNoteFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteUpdate, request),
		deleteNoteFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorNoteDelete, request),
		listBoardScenariosFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioList, projectId),
		readBoardScenarioFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioRead, request),
		writeBoardScenarioFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioWrite, request),
		deleteBoardScenarioFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorBoardScenarioDelete, request),
		readVersionStatusFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionStatus, projectId),
		listVersionsFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionList, projectId),
		diffVersionsFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionDiff, request),
		createVersionFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionCommit, request),
		checkoutVersionFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionCheckout, request),
		updateVersionTagFn: (request) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorVersionTag, request),
	},
	editorMcp: {
		readOverviewFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpOverviewRead),
		configureFn: (configuration) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpConfigure, configuration),
		commandFn: (command) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpCommand, command),
		onOverviewChangedFn: (listenerFn) => {
			editorMcpOverviewListeners.add(listenerFn);
			return () => editorMcpOverviewListeners.delete(listenerFn);
		},
		setProjectContextFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextSet, projectId),
		clearProjectContextFn: (projectId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.editorMcpProjectContextClear, projectId),
		onVersionCheckoutRequestedFn: (listenerFn) => {
			editorMcpVersionCheckoutListeners.add(listenerFn);
			return () => editorMcpVersionCheckoutListeners.delete(listenerFn);
		},
	},
	arkpack: {
		listFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackList),
		readFn: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRead, packageId),
		installFn: (record) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackInstall, record),
		removeFn: (packageId) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackRemove, packageId),
		openUserDirectoryFn: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.arkpackOpenUserDirectory),
	},
	save: {
		readFn: (key) => ipcRenderer.invoke(ArkiniElectronApi.channels.saveRead, key),
		writeFn: (key, bytes) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.saveWrite, key, bytes),
		clearFn: (key) => ipcRenderer.invoke(ArkiniElectronApi.channels.saveClear, key),
	},
	diagnostics: {
		writeFn: (record) =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.diagnosticsWrite, record),
		openDirectoryFn: () =>
			ipcRenderer.invoke(ArkiniElectronApi.channels.diagnosticsOpenDirectory),
	},
	userData: {
		openDirectoryFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.userDataOpenDirectory),
	},
	window: {
		readModeFn: () => ipcRenderer.invoke(ArkiniElectronApi.channels.windowModeRead),
		writeModeFn: (mode) => ipcRenderer.invoke(ArkiniElectronApi.channels.windowModeWrite, mode),
		onModeChangedFn: (listenerFn) => {
			windowModeListeners.add(listenerFn);
			return () => windowModeListeners.delete(listenerFn);
		},
	},
	lifecycle: {
		waitUntilVisibleFn: () => visiblePromise,
		onBeforeCloseFn: (listenerFn) => {
			beforeCloseListeners.add(listenerFn);
			return () => beforeCloseListeners.delete(listenerFn);
		},
		onBeforeCloseReadyFn: (listenerFn) => {
			beforeCloseReadyListeners.add(listenerFn);
			return () => beforeCloseReadyListeners.delete(listenerFn);
		},
		onCloseFailedFn: (listenerFn) => {
			closeFailedListeners.add(listenerFn);
			return () => closeFailedListeners.delete(listenerFn);
		},
		requestCloseFn: () => {
			if (requestedClose !== undefined) return requestedClose.promise;
			let resolveRequestFn: () => void = () => undefined;
			let rejectRequestFn: (error: unknown) => void = () => undefined;
			const promise = new Promise<void>((resolveFn, rejectFn) => {
				resolveRequestFn = resolveFn;
				rejectRequestFn = rejectFn;
			});
			requestedClose = {
				promise,
				resolveFn: resolveRequestFn,
				rejectFn: rejectRequestFn,
			};
			ipcRenderer.send(ArkiniElectronApi.channels.requestClose);
			return promise;
		},
		forceCloseFn: () => ipcRenderer.send(ArkiniElectronApi.channels.forceClose),
	},
};

contextBridge.exposeInMainWorld("arkini", api);
