import type { AppearanceAccentSchema } from "./appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "./appearance/AppearanceThemeSchema";
import type { CheatAvailabilitySchema } from "./cheat/CheatAvailabilitySchema";
import type { InstallationStatus } from "./cli/InstallationStatus";
import type { CompletionStatus } from "./cli/CompletionStatus";
import type { LastPackageIdSchema } from "./launcher/LastPackageIdSchema";
import type { readPreferredLanguagesFn } from "./localization/readPreferredLanguagesFn";
import type { DiagnosticRecord } from "./diagnostics/DiagnosticRecord";
import type { ApplicationLogRecordSchema } from "./diagnostics/ApplicationLogRecord";
import type { GameIncidentWrite } from "./incident/GameIncidentWrite";
import type { EditorProjectTransport } from "./editor/EditorProjectTransport";
import type { EditorSourceExportSchema } from "./editor/EditorSourceExportSchema";
import type { EditorMcpCommandResultSchema } from "~/authoring-mcp/schema/EditorMcpCommandResultSchema";
import type { EditorMcpCommandSchema } from "~/authoring-mcp/schema/EditorMcpCommandSchema";
import type { EditorMcpConfigurationSchema } from "~/authoring-mcp/schema/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";
import type { WindowModeSchema } from "./window/WindowModeSchema";
import type { SoundChannel, SoundSettings } from "./sound/SoundSettings";
import type { SoundVolumeSchema } from "./sound/SoundVolumeSchema";

export namespace SerakkiElectronApi {
	export const channels = {
		serapackList: "serakki:serapack:list",
		serapackRead: "serakki:serapack:read",
		serapackImport: "serakki:serapack:import",
		serapackInstallEditorBuild: "serakki:serapack:install-editor-build",
		serapackRemove: "serakki:serapack:remove",
		serapackOpenUserDirectory: "serakki:serapack:open-user-directory",
		saveRead: "serakki:save:read",
		saveWrite: "serakki:save:write",
		saveClear: "serakki:save:clear",
		saveList: "serakki:save:list",
		saveRestore: "serakki:save:restore",
		appearanceRead: "serakki:appearance:read",
		appearanceWrite: "serakki:appearance:write",
		appearanceAccentRead: "serakki:appearance:accent:read",
		appearanceAccentWrite: "serakki:appearance:accent:write",
		cheatAvailabilityRead: "serakki:cheats:available:read",
		cheatAvailabilityWrite: "serakki:cheats:available:write",
		soundRead: "serakki:sound:read",
		soundWrite: "serakki:sound:write",
		clipboardWriteText: "serakki:clipboard:write-text",
		cliStatus: "serakki:cli:status",
		cliInstall: "serakki:cli:install",
		cliReplace: "serakki:cli:replace",
		cliUninstall: "serakki:cli:uninstall",
		cliCompletionStatus: "serakki:cli:completion:status",
		cliCompletionInstall: "serakki:cli:completion:install",
		cliCompletionReplace: "serakki:cli:completion:replace",
		cliCompletionUninstall: "serakki:cli:completion:uninstall",
		launcherLastPackageIdRead: "serakki:launcher:last-package:read",
		launcherLastPackageIdWrite: "serakki:launcher:last-package:write",
		localizationPreferredLanguagesRead: "serakki:localization:preferred-languages:read",
		editorStatus: "serakki:editor:status",
		editorAwaitIdle: "serakki:editor:await-idle",
		editorProjectBuildVersionSave: "serakki:editor:build:version:save",
		editorProjectBuild: "serakki:editor:project:build",
		editorProjectBuildSave: "serakki:editor:project:build:save",
		editorProjectCreate: "serakki:editor:project:create",
		editorProjectDismissInvalid: "serakki:editor:project:dismiss-invalid",
		editorProjectDelete: "serakki:editor:project:delete",
		editorProjectDeleteItem: "serakki:editor:project:delete-item",
		editorProjectSaveResourceMetadata: "serakki:editor:project:save-resource-metadata",
		editorProjectDeleteResource: "serakki:editor:project:delete-resource",
		editorProjectExportJsonDirectory: "serakki:editor:project:export-json-directory",
		editorProjectImportJsonDirectory: "serakki:editor:project:import-json-directory",
		editorProjectImportSerapack: "serakki:editor:project:import-serapack",
		editorProjectImportInstalledSerapack: "serakki:editor:project:import-installed-serapack",
		editorProjectImportResources: "serakki:editor:project:import-resources",
		editorProjectList: "serakki:editor:project:list",
		editorProjectOpenDirectory: "serakki:editor:project:open-directory",
		editorProjectOptimizeResources: "serakki:editor:project:optimize-resources",
		editorProjectOptimizeResourcesProgress:
			"serakki:editor:project:optimize-resources:progress",
		editorProjectRead: "serakki:editor:project:read",
		editorProjectRefresh: "serakki:editor:project:refresh",
		editorProjectChanged: "serakki:editor:project:changed",
		editorProjectReplaceConfig: "serakki:editor:project:replace-config",
		editorProjectReplaceResource: "serakki:editor:project:replace-resource",
		editorProjectUpsertItem: "serakki:editor:project:upsert-item",
		editorNoteList: "serakki:editor:note:list",
		editorNoteCreate: "serakki:editor:note:create",
		editorNoteUpdate: "serakki:editor:note:update",
		editorNoteDelete: "serakki:editor:note:delete",
		editorMcpOverviewRead: "serakki:editor:mcp:overview:read",
		editorMcpConfigure: "serakki:editor:mcp:configure",
		editorMcpCommand: "serakki:editor:mcp:command",
		editorMcpOverviewChanged: "serakki:editor:mcp:overview:changed",
		editorMcpProjectContextSet: "serakki:editor:mcp:project-context:set",
		editorMcpProjectContextClear: "serakki:editor:mcp:project-context:clear",
		diagnosticsWrite: "serakki:diagnostics:write",
		diagnosticsWriteApplication: "serakki:diagnostics:write-application",
		diagnosticsOpenDirectory: "serakki:diagnostics:open-directory",
		incidentWrite: "serakki:incident:write",
		userDataOpenDirectory: "serakki:user-data:open-directory",
		windowModeRead: "serakki:window:mode:read",
		windowModeWrite: "serakki:window:mode:write",
		windowModeChanged: "serakki:window:mode:changed",
		windowVisible: "serakki:lifecycle:window-visible",
		beforeClose: "serakki:lifecycle:before-close",
		closeReady: "serakki:lifecycle:close-ready",
		closeFailed: "serakki:lifecycle:close-failed",
		requestClose: "serakki:lifecycle:request-close",
		forceClose: "serakki:lifecycle:force-close",
	} as const;

	export interface SerapackFile {
		readonly packageId: string;
		readonly filename: string;
		readonly contentHash: string;
		readonly title: string;
		readonly version: string;
		readonly serakki: string;
		readonly provenance:
			| {
					readonly type: "official";
			  }
			| {
					readonly type: "community";
			  };
		readonly source: "bundled" | "user";
		readonly overridesBundled: boolean;
	}

	export interface SerapackLoadedFile extends SerapackFile {
		readonly config: unknown;
		readonly resources: ReadonlyArray<{
			readonly id: string;
			readonly type: "artwork" | "image" | "music" | "sfx";
			readonly url: string;
		}>;
	}

	export interface SerapackEditorBuildInstall {
		readonly packageId: string;
		readonly expectedRevision: number;
		readonly contentHash: string;
	}

	export type SaveSlot = "current" | "manual" | "5-min" | "30-min" | "4-hour";
	/** Plain preload transport; persistence owns validation and rotation policy. */
	export interface SaveSlotInfo {
		readonly slot: SaveSlot;
		readonly savedAt: number | null;
	}
	export interface SaveKey {
		readonly packageId: string;
	}

	export interface Api {
		readonly file: {
			readonly readPathFn: (file: File) => string;
		};
		readonly serapack: {
			readonly listFn: () => Promise<ReadonlyArray<SerapackFile>>;
			readonly readFn: (packageId: string) => Promise<ReadonlyArray<SerapackLoadedFile>>;
			readonly importFn: () => Promise<SerapackFile | null>;
			readonly installEditorBuildFn: (
				record: SerapackEditorBuildInstall,
			) => Promise<SerapackFile>;
			readonly removeFn: (packageId: string) => Promise<void>;
			readonly openUserDirectoryFn: () => Promise<void>;
		};
		readonly appearance: {
			readonly readFn: () => Promise<AppearanceThemeSchema.Type>;
			readonly writeFn: (theme: AppearanceThemeSchema.Type) => Promise<void>;
			readonly readAccentFn: () => Promise<AppearanceAccentSchema.Type>;
			readonly writeAccentFn: (accent: AppearanceAccentSchema.Type) => Promise<void>;
		};
		readonly cheats: {
			readonly readAvailableFn: () => Promise<CheatAvailabilitySchema.Type>;
			readonly writeAvailableFn: (available: CheatAvailabilitySchema.Type) => Promise<void>;
		};
		readonly sound: {
			readonly readFn: () => Promise<SoundSettings>;
			readonly writeFn: (
				channel: SoundChannel,
				volume: SoundVolumeSchema.Type,
			) => Promise<void>;
		};
		readonly clipboard: {
			readonly writeTextFn: (text: string) => Promise<void>;
		};
		readonly cli: {
			readonly statusFn: () => Promise<InstallationStatus>;
			readonly installFn: () => Promise<InstallationStatus>;
			readonly replaceFn: () => Promise<InstallationStatus>;
			readonly uninstallFn: () => Promise<InstallationStatus>;
			readonly completion: {
				readonly statusFn: () => Promise<CompletionStatus>;
				readonly installFn: () => Promise<CompletionStatus>;
				readonly replaceFn: () => Promise<CompletionStatus>;
				readonly uninstallFn: () => Promise<CompletionStatus>;
			};
		};
		readonly launcher: {
			readonly readLastPackageIdFn: () => Promise<LastPackageIdSchema.Type | null>;
			readonly writeLastPackageIdFn: (packageId: LastPackageIdSchema.Type) => Promise<void>;
		};
		readonly localization: {
			readonly readPreferredLanguagesFn: readPreferredLanguagesFn;
		};
		readonly editor: {
			readonly statusFn: () => Promise<EditorProjectTransport.ServiceStatus>;
			readonly awaitIdleFn: () => Promise<EditorProjectTransport.Result<void>>;
			readonly saveBuildVersionFn: (
				request: EditorProjectTransport.SaveBuildVersionRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.BuildVersion>>;
			readonly buildProjectFn: (
				request: EditorProjectTransport.BuildRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Build>>;
			readonly saveProjectBuildFn: (
				request: EditorProjectTransport.ReadBuildRequest,
			) => Promise<EditorProjectTransport.Result<boolean>>;
			readonly createProjectFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly deleteProjectFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly deleteItemFn: (
				request: EditorProjectTransport.DeleteItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly saveResourceMetadataFn: (
				request: EditorProjectTransport.SaveResourceMetadataRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly deleteResourceFn: (
				request: EditorProjectTransport.DeleteResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly importJsonDirectoryFn: () => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.Descriptor | null>
			>;
			readonly importSerapackFn: () => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.Descriptor | null>
			>;
			readonly importInstalledSerapackFn: (
				packageId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Descriptor>>;
			readonly importResourcesFn: (
				request: EditorProjectTransport.ImportResourcesRequest,
			) => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.ImportResourcesResult>
			>;
			readonly exportJsonDirectoryFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorSourceExportSchema.Type | null>>;
			readonly listProjectsFn: () => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.ProjectCandidate>
				>
			>;
			readonly dismissInvalidProjectFn: (
				root: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly openProjectDirectoryFn: (
				root: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly readProjectFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project | null>>;
			readonly refreshProjectFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly onProjectChangedFn: (listenerFn: (projectId: string) => void) => () => void;
			readonly optimizeResourcesFn: (
				request: EditorProjectTransport.OptimizeResourcesRequest,
			) => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.OptimizeResourcesResult>
			>;
			readonly onOptimizeResourcesProgressFn: (
				listenerFn: (progress: EditorProjectTransport.OptimizeResourcesProgress) => void,
			) => () => void;
			readonly replaceConfigFn: (
				request: EditorProjectTransport.ReplaceConfigRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly replaceResourceFn: (
				request: EditorProjectTransport.ReplaceResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly upsertItemFn: (
				request: EditorProjectTransport.UpsertItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly listNotesFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<ReadonlyArray<EditorProjectTransport.Note>>>;
			readonly createNoteFn: (
				request: EditorProjectTransport.CreateNoteRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Note>>;
			readonly updateNoteFn: (
				request: EditorProjectTransport.UpdateNoteRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Note>>;
			readonly deleteNoteFn: (
				request: EditorProjectTransport.DeleteNoteRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
		};
		readonly editorMcp: {
			readonly readOverviewFn: () => Promise<EditorMcpOverviewSchema.Type>;
			readonly configureFn: (
				configuration: EditorMcpConfigurationSchema.Type,
			) => Promise<EditorMcpOverviewSchema.Type>;
			readonly commandFn: (
				command: EditorMcpCommandSchema.Type,
			) => Promise<EditorMcpCommandResultSchema.Type>;
			readonly onOverviewChangedFn: (
				listenerFn: (overview: EditorMcpOverviewSchema.Type) => void,
			) => () => void;
			readonly setProjectContextFn: (projectId: string) => Promise<void>;
			readonly clearProjectContextFn: (projectId: string) => Promise<void>;
		};
		readonly save: {
			readonly readFn: (key: SaveKey, slot?: SaveSlot) => Promise<Uint8Array | null>;
			readonly writeFn: (
				key: SaveKey,
				bytes: Uint8Array,
				slot?: "current" | "manual",
			) => Promise<void>;
			readonly clearFn: (key: SaveKey) => Promise<void>;
			readonly listFn: (key: SaveKey) => Promise<readonly SaveSlotInfo[]>;
			readonly restoreFn: (key: SaveKey, bytes: Uint8Array) => Promise<void>;
		};
		readonly diagnostics: {
			readonly writeFn: (record: DiagnosticRecord) => Promise<void>;
			readonly writeApplicationFn: (record: ApplicationLogRecordSchema.Type) => Promise<void>;
			readonly openDirectoryFn: () => Promise<void>;
		};
		readonly incident: {
			readonly writeFn: (incident: GameIncidentWrite) => Promise<void>;
		};
		readonly userData: {
			readonly openDirectoryFn: () => Promise<void>;
		};
		readonly window: {
			readonly readModeFn: () => Promise<WindowModeSchema.Type>;
			readonly writeModeFn: (mode: WindowModeSchema.Type) => Promise<void>;
			readonly onModeChangedFn: (
				listenerFn: (mode: WindowModeSchema.Type) => void,
			) => () => void;
		};
		readonly lifecycle: {
			readonly waitUntilVisibleFn: () => Promise<number>;
			readonly onBeforeCloseFn: (listenerFn: () => Promise<void>) => () => void;
			readonly onBeforeCloseReadyFn: (listenerFn: () => Promise<void>) => () => void;
			readonly onCloseFailedFn: (listenerFn: (error: unknown) => void) => () => void;
			readonly requestCloseFn: () => Promise<void>;
			readonly forceCloseFn: () => void;
		};
	}
}

declare global {
	interface Window {
		readonly serakki: SerakkiElectronApi.Api;
	}
}
