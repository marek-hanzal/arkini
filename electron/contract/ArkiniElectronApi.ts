import type { AppearanceAccentSchema } from "./appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "./appearance/AppearanceThemeSchema";
import type { CheatAvailabilitySchema } from "./cheat/CheatAvailabilitySchema";
import type { InstallationStatus } from "./cli/InstallationStatus";
import type { CompletionStatus } from "./cli/CompletionStatus";
import type {
	ChatGptAssetCandidateSchema,
	ChatGptSurfaceSchema,
	ChatGptViewStateSchema,
} from "./chatgpt/ChatGptSurfaceSchema";
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

export namespace ArkiniElectronApi {
	export const channels = {
		arkpackList: "arkini:arkpack:list",
		arkpackRead: "arkini:arkpack:read",
		arkpackInstall: "arkini:arkpack:install",
		arkpackRemove: "arkini:arkpack:remove",
		arkpackOpenUserDirectory: "arkini:arkpack:open-user-directory",
		saveRead: "arkini:save:read",
		saveWrite: "arkini:save:write",
		saveClear: "arkini:save:clear",
		appearanceRead: "arkini:appearance:read",
		appearanceWrite: "arkini:appearance:write",
		appearanceAccentRead: "arkini:appearance:accent:read",
		appearanceAccentWrite: "arkini:appearance:accent:write",
		cheatAvailabilityRead: "arkini:cheats:available:read",
		cheatAvailabilityWrite: "arkini:cheats:available:write",
		chatGptSurfaceSet: "arkini:chatgpt:surface:set",
		chatGptStateChanged: "arkini:chatgpt:state:changed",
		chatGptAssetCandidate: "arkini:chatgpt:asset:candidate",
		clipboardWriteText: "arkini:clipboard:write-text",
		cliStatus: "arkini:cli:status",
		cliInstall: "arkini:cli:install",
		cliReplace: "arkini:cli:replace",
		cliUninstall: "arkini:cli:uninstall",
		cliCompletionStatus: "arkini:cli:completion:status",
		cliCompletionInstall: "arkini:cli:completion:install",
		cliCompletionReplace: "arkini:cli:completion:replace",
		cliCompletionUninstall: "arkini:cli:completion:uninstall",
		launcherLastPackageIdRead: "arkini:launcher:last-package:read",
		launcherLastPackageIdWrite: "arkini:launcher:last-package:write",
		localizationPreferredLanguagesRead: "arkini:localization:preferred-languages:read",
		editorStatus: "arkini:editor:status",
		editorAwaitIdle: "arkini:editor:await-idle",
		editorProjectBuild: "arkini:editor:project:build",
		editorProjectBuildRead: "arkini:editor:project:build:read",
		editorProjectBuildSave: "arkini:editor:project:build:save",
		editorProjectCreate: "arkini:editor:project:create",
		editorProjectDelete: "arkini:editor:project:delete",
		editorProjectDeleteItem: "arkini:editor:project:delete-item",
		editorProjectDeleteResource: "arkini:editor:project:delete-resource",
		editorProjectExportJsonDirectory: "arkini:editor:project:export-json-directory",
		editorProjectImportJsonDirectory: "arkini:editor:project:import-json-directory",
		editorProjectList: "arkini:editor:project:list",
		editorProjectOpenDirectory: "arkini:editor:project:open-directory",
		editorProjectRead: "arkini:editor:project:read",
		editorProjectRefresh: "arkini:editor:project:refresh",
		editorProjectChanged: "arkini:editor:project:changed",
		editorProjectReplaceConfig: "arkini:editor:project:replace-config",
		editorProjectReplaceResource: "arkini:editor:project:replace-resource",
		editorProjectSaveResource: "arkini:editor:project:save-resource",
		editorProjectUpsertItem: "arkini:editor:project:upsert-item",
		editorProjectUpsertResources: "arkini:editor:project:upsert-resources",
		editorNoteList: "arkini:editor:note:list",
		editorNoteCreate: "arkini:editor:note:create",
		editorNoteUpdate: "arkini:editor:note:update",
		editorNoteDelete: "arkini:editor:note:delete",
		editorVersionStatus: "arkini:editor:version:status",
		editorVersionCommitPreview: "arkini:editor:version:commit-preview",
		editorVersionList: "arkini:editor:version:list",
		editorVersionDiff: "arkini:editor:version:diff",
		editorVersionCommit: "arkini:editor:version:commit",
		editorVersionCheckout: "arkini:editor:version:checkout",
		editorVersionTag: "arkini:editor:version:tag",
		editorBoardScenarioList: "arkini:editor:board-scenario:list",
		editorBoardScenarioRead: "arkini:editor:board-scenario:read",
		editorBoardScenarioWrite: "arkini:editor:board-scenario:write",
		editorBoardScenarioDelete: "arkini:editor:board-scenario:delete",
		editorMcpOverviewRead: "arkini:editor:mcp:overview:read",
		editorMcpConfigure: "arkini:editor:mcp:configure",
		editorMcpCommand: "arkini:editor:mcp:command",
		editorMcpOverviewChanged: "arkini:editor:mcp:overview:changed",
		editorMcpProjectContextSet: "arkini:editor:mcp:project-context:set",
		editorMcpProjectContextClear: "arkini:editor:mcp:project-context:clear",
		editorMcpVersionCheckoutRequest: "arkini:editor:mcp:version-checkout:request",
		diagnosticsWrite: "arkini:diagnostics:write",
		diagnosticsWriteApplication: "arkini:diagnostics:write-application",
		diagnosticsOpenDirectory: "arkini:diagnostics:open-directory",
		incidentWrite: "arkini:incident:write",
		userDataOpenDirectory: "arkini:user-data:open-directory",
		windowModeRead: "arkini:window:mode:read",
		windowModeWrite: "arkini:window:mode:write",
		windowModeChanged: "arkini:window:mode:changed",
		windowVisible: "arkini:lifecycle:window-visible",
		beforeClose: "arkini:lifecycle:before-close",
		closeReady: "arkini:lifecycle:close-ready",
		closeFailed: "arkini:lifecycle:close-failed",
		requestClose: "arkini:lifecycle:request-close",
		forceClose: "arkini:lifecycle:force-close",
	} as const;

	export interface ArkpackFile {
		readonly packageId: string;
		readonly filename: string;
		readonly bytes: Uint8Array;
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

	export interface ArkpackInstall {
		readonly packageId: string;
		readonly bytes: Uint8Array;
	}

	export interface EditorMcpVersionCheckoutRequest {
		readonly projectId: string;
		readonly versionId: string;
	}

	export type EditorMcpVersionCheckoutResponse =
		| {
				readonly type: "success";
		  }
		| {
				readonly type: "failure";
				readonly message: string;
		  };

	export interface SaveKey {
		readonly packageId: string;
	}

	export interface Api {
		readonly arkpack: {
			readonly listFn: () => Promise<ReadonlyArray<ArkpackFile>>;
			readonly readFn: (packageId: string) => Promise<ReadonlyArray<ArkpackFile>>;
			readonly installFn: (record: ArkpackInstall) => Promise<void>;
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
		readonly chatGpt: {
			readonly setSurfaceFn: (surface: ChatGptSurfaceSchema.Type | null) => Promise<void>;
			readonly onStateChangedFn: (
				listenerFn: (state: ChatGptViewStateSchema.Type) => void,
			) => () => void;
			readonly onAssetCandidateFn: (
				listenerFn: (candidate: ChatGptAssetCandidateSchema.Type) => void,
			) => () => void;
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
			readonly buildProjectFn: (
				request: EditorProjectTransport.BuildRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Build>>;
			readonly readProjectBuildFn: (
				request: EditorProjectTransport.ReadBuildRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.BuildContent>>;
			readonly saveProjectBuildFn: (
				request: EditorProjectTransport.ReadBuildRequest,
			) => Promise<EditorProjectTransport.Result<boolean>>;
			readonly createProjectFn: (
				request: EditorProjectTransport.CreateProjectRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly deleteProjectFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly deleteItemFn: (
				request: EditorProjectTransport.DeleteItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly deleteResourceFn: (
				request: EditorProjectTransport.DeleteResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly importJsonDirectoryFn: () => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.Descriptor | null>
			>;
			readonly exportJsonDirectoryFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorSourceExportSchema.Type | null>>;
			readonly listProjectsFn: () => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.ProjectCandidate>
				>
			>;
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
			readonly replaceConfigFn: (
				request: EditorProjectTransport.ReplaceConfigRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly replaceResourceFn: (
				request: EditorProjectTransport.ReplaceResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly saveResourceFn: (
				request: EditorProjectTransport.SaveResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly upsertItemFn: (
				request: EditorProjectTransport.UpsertItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly upsertResourcesFn: (
				request: EditorProjectTransport.UpsertResourcesRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
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
			readonly listBoardScenariosFn: (
				projectId: string,
			) => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.BoardScenarioDescriptor>
				>
			>;
			readonly readBoardScenarioFn: (
				request: EditorProjectTransport.BoardScenarioKeyRequest,
			) => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.BoardScenario | null>
			>;
			readonly writeBoardScenarioFn: (
				request: EditorProjectTransport.WriteBoardScenarioRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.BoardScenario>>;
			readonly deleteBoardScenarioFn: (
				request: EditorProjectTransport.BoardScenarioKeyRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly readVersionStatusFn: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionStatus>>;
			readonly previewVersionCommitFn: (
				projectId: string,
			) => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.VersionCommitPreview>
			>;
			readonly listVersionsFn: (
				projectId: string,
			) => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.VersionDescriptor>
				>
			>;
			readonly diffVersionsFn: (
				request: EditorProjectTransport.VersionDiffRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDiff>>;
			readonly createVersionFn: (
				request: EditorProjectTransport.VersionCommitRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDescriptor>>;
			readonly checkoutVersionFn: (
				request: EditorProjectTransport.VersionCheckoutRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly updateVersionTagFn: (
				request: EditorProjectTransport.VersionTagRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDescriptor>>;
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
			readonly onVersionCheckoutRequestedFn: (
				listenerFn: (request: EditorMcpVersionCheckoutRequest) => Promise<void>,
			) => () => void;
		};
		readonly save: {
			readonly readFn: (key: SaveKey) => Promise<Uint8Array | null>;
			readonly writeFn: (key: SaveKey, bytes: Uint8Array) => Promise<void>;
			readonly clearFn: (key: SaveKey) => Promise<void>;
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
		readonly arkini: ArkiniElectronApi.Api;
	}
}
