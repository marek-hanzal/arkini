import { contextBridge, ipcRenderer, webUtils } from "electron";
import { SerakkiElectronApi } from "../contract/SerakkiElectronApi";

const beforeCloseListeners = new Set<() => Promise<void>>();
const beforeCloseReadyListeners = new Set<() => Promise<void>>();
const closeFailedListeners = new Set<(error: unknown) => void>();
const editorProjectChangedListeners = new Set<
	Parameters<SerakkiElectronApi.Api["editor"]["onProjectChangedFn"]>[0]
>();
const editorResourceOptimizationProgressListeners = new Set<
	Parameters<SerakkiElectronApi.Api["editor"]["onOptimizeResourcesProgressFn"]>[0]
>();
const editorMcpOverviewListeners = new Set<
	Parameters<SerakkiElectronApi.Api["editorMcp"]["onOverviewChangedFn"]>[0]
>();
const windowModeListeners = new Set<
	Parameters<SerakkiElectronApi.Api["window"]["onModeChangedFn"]>[0]
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

ipcRenderer.on(SerakkiElectronApi.channels.windowVisible, () => {
	if (visibleAtMs !== undefined) return;
	visibleAtMs = performance.now();
	resolveVisibleFn(visibleAtMs);
});

ipcRenderer.on(SerakkiElectronApi.channels.windowModeChanged, (_event, mode) => {
	for (const listenerFn of Array.from(windowModeListeners)) listenerFn(mode);
});

ipcRenderer.on(SerakkiElectronApi.channels.editorProjectChanged, (_event, projectId) => {
	for (const listenerFn of Array.from(editorProjectChangedListeners)) listenerFn(projectId);
});

ipcRenderer.on(
	SerakkiElectronApi.channels.editorProjectOptimizeResourcesProgress,
	(_event, progress) => {
		for (const listenerFn of Array.from(editorResourceOptimizationProgressListeners))
			listenerFn(progress);
	},
);

ipcRenderer.on(SerakkiElectronApi.channels.editorMcpOverviewChanged, (_event, overview) => {
	for (const listenerFn of Array.from(editorMcpOverviewListeners)) listenerFn(overview);
});

ipcRenderer.on(SerakkiElectronApi.channels.beforeClose, async () => {
	if (closing) return;
	closing = true;
	try {
		await Promise.all(Array.from(beforeCloseListeners, (listenerFn) => listenerFn()));
		await Promise.all(Array.from(beforeCloseReadyListeners, (listenerFn) => listenerFn()));
		requestedClose?.resolveFn();
		requestedClose = undefined;
		ipcRenderer.send(SerakkiElectronApi.channels.closeReady);
	} catch (error) {
		closing = false;
		for (const listenerFn of Array.from(closeFailedListeners)) listenerFn(error);
		ipcRenderer.send(SerakkiElectronApi.channels.closeFailed, String(error));
		requestedClose?.rejectFn(error);
		requestedClose = undefined;
	}
});

const api: SerakkiElectronApi.Api = {
	file: {
		readPathFn: (file) => webUtils.getPathForFile(file),
	},
	appearance: {
		readFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.appearanceRead),
		writeFn: (theme) => ipcRenderer.invoke(SerakkiElectronApi.channels.appearanceWrite, theme),
		readAccentFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.appearanceAccentRead),
		writeAccentFn: (accent) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.appearanceAccentWrite, accent),
	},
	cheats: {
		readAvailableFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.cheatAvailabilityRead),
		writeAvailableFn: (available) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.cheatAvailabilityWrite, available),
	},
	sound: {
		readFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.soundRead),
		writeFn: (channel, volume) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.soundWrite, channel, volume),
	},
	clipboard: {
		writeTextFn: (text) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.clipboardWriteText, text),
	},
	cli: {
		statusFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliStatus),
		installFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliInstall),
		replaceFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliReplace),
		uninstallFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliUninstall),
		completion: {
			statusFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliCompletionStatus),
			installFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliCompletionInstall),
			replaceFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.cliCompletionReplace),
			uninstallFn: () =>
				ipcRenderer.invoke(SerakkiElectronApi.channels.cliCompletionUninstall),
		},
	},
	launcher: {
		readLastPackageIdFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.launcherLastPackageIdRead),
		writeLastPackageIdFn: (packageId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.launcherLastPackageIdWrite, packageId),
	},
	localization: {
		readPreferredLanguagesFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.localizationPreferredLanguagesRead),
	},
	editor: {
		saveBuildVersionFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectBuildVersionSave, request),
		buildProjectFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectBuild, request),
		saveProjectBuildFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectBuildSave, request),
		statusFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.editorStatus),
		awaitIdleFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.editorAwaitIdle),
		createProjectFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectCreate, projectId),
		deleteProjectFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectDelete, projectId),
		deleteItemFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectDeleteItem, request),
		saveResourceMetadataFn: (request) =>
			ipcRenderer.invoke(
				SerakkiElectronApi.channels.editorProjectSaveResourceMetadata,
				request,
			),
		deleteResourceFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectDeleteResource, request),
		exportJsonDirectoryFn: (projectId) =>
			ipcRenderer.invoke(
				SerakkiElectronApi.channels.editorProjectExportJsonDirectory,
				projectId,
			),
		importJsonDirectoryFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectImportJsonDirectory),
		importSerapackFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectImportSerapack),
		importInstalledSerapackFn: (packageId) =>
			ipcRenderer.invoke(
				SerakkiElectronApi.channels.editorProjectImportInstalledSerapack,
				packageId,
			),
		importResourcesFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectImportResources, request),
		listProjectsFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectList),
		dismissInvalidProjectFn: (root) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectDismissInvalid, root),
		openProjectDirectoryFn: (root) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectOpenDirectory, root),
		readProjectFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectRead, projectId),
		refreshProjectFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectRefresh, projectId),
		onProjectChangedFn: (listenerFn) => {
			editorProjectChangedListeners.add(listenerFn);
			return () => editorProjectChangedListeners.delete(listenerFn);
		},
		onOptimizeResourcesProgressFn: (listenerFn) => {
			editorResourceOptimizationProgressListeners.add(listenerFn);
			return () => editorResourceOptimizationProgressListeners.delete(listenerFn);
		},
		optimizeResourcesFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectOptimizeResources, request),
		replaceConfigFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectReplaceConfig, request),
		replaceResourceFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectReplaceResource, request),
		upsertItemFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorProjectUpsertItem, request),
		listNotesFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorNoteList, projectId),
		createNoteFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorNoteCreate, request),
		updateNoteFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorNoteUpdate, request),
		deleteNoteFn: (request) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorNoteDelete, request),
	},
	editorMcp: {
		readOverviewFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.editorMcpOverviewRead),
		configureFn: (configuration) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorMcpConfigure, configuration),
		commandFn: (command) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorMcpCommand, command),
		onOverviewChangedFn: (listenerFn) => {
			editorMcpOverviewListeners.add(listenerFn);
			return () => editorMcpOverviewListeners.delete(listenerFn);
		},
		setProjectContextFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorMcpProjectContextSet, projectId),
		clearProjectContextFn: (projectId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.editorMcpProjectContextClear, projectId),
	},
	serapack: {
		listFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.serapackList),
		readFn: (packageId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.serapackRead, packageId),
		importFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.serapackImport),
		installEditorBuildFn: (record) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.serapackInstallEditorBuild, record),
		removeFn: (packageId) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.serapackRemove, packageId),
		openUserDirectoryFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.serapackOpenUserDirectory),
	},
	save: {
		readFn: (key, slot) => ipcRenderer.invoke(SerakkiElectronApi.channels.saveRead, key, slot),
		writeFn: (key, bytes, slot) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.saveWrite, key, bytes, slot),
		clearFn: (key) => ipcRenderer.invoke(SerakkiElectronApi.channels.saveClear, key),
		listFn: (key) => ipcRenderer.invoke(SerakkiElectronApi.channels.saveList, key),
		restoreFn: (key, bytes) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.saveRestore, key, bytes),
	},
	diagnostics: {
		writeFn: (record) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.diagnosticsWrite, record),
		writeApplicationFn: (record) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.diagnosticsWriteApplication, record),
		openDirectoryFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.diagnosticsOpenDirectory),
		exportFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.diagnosticsExport),
	},
	incident: {
		writeFn: (incident) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.incidentWrite, incident),
	},
	userData: {
		hardResetFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.userDataHardReset),
		openDirectoryFn: () =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.userDataOpenDirectory),
	},
	window: {
		readModeFn: () => ipcRenderer.invoke(SerakkiElectronApi.channels.windowModeRead),
		writeModeFn: (mode) =>
			ipcRenderer.invoke(SerakkiElectronApi.channels.windowModeWrite, mode),
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
			ipcRenderer.send(SerakkiElectronApi.channels.requestClose);
			return promise;
		},
		forceCloseFn: () => ipcRenderer.send(SerakkiElectronApi.channels.forceClose),
	},
};

contextBridge.exposeInMainWorld("serakki", api);
