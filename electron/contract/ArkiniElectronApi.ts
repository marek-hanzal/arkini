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
import type { DiagnosticRecord } from "./diagnostics/DiagnosticRecord";
import type { EditorProjectTransport } from "./editor/EditorProjectTransport";
import type { EditorMcpCommandResultSchema } from "./editor/EditorMcpCommandResultSchema";
import type { EditorMcpCommandSchema } from "./editor/EditorMcpCommandSchema";
import type { EditorMcpConfigurationSchema } from "./editor/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "./editor/EditorMcpOverviewSchema";
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
		editorProjectOpenExportDirectory: "arkini:editor:project:open-export-directory",
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
		diagnosticsOpenDirectory: "arkini:diagnostics:open-directory",
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
			readonly list: () => Promise<ReadonlyArray<ArkpackFile>>;
			readonly read: (packageId: string) => Promise<ReadonlyArray<ArkpackFile>>;
			readonly install: (record: ArkpackInstall) => Promise<void>;
			readonly remove: (packageId: string) => Promise<void>;
			readonly openUserDirectory: () => Promise<void>;
		};
		readonly appearance: {
			readonly read: () => Promise<AppearanceThemeSchema.Type>;
			readonly write: (theme: AppearanceThemeSchema.Type) => Promise<void>;
			readonly readAccent: () => Promise<AppearanceAccentSchema.Type>;
			readonly writeAccent: (accent: AppearanceAccentSchema.Type) => Promise<void>;
		};
		readonly cheats: {
			readonly readAvailable: () => Promise<CheatAvailabilitySchema.Type>;
			readonly writeAvailable: (available: CheatAvailabilitySchema.Type) => Promise<void>;
		};
		readonly chatGpt: {
			readonly setSurface: (surface: ChatGptSurfaceSchema.Type | null) => Promise<void>;
			readonly onStateChanged: (
				listener: (state: ChatGptViewStateSchema.Type) => void,
			) => () => void;
			readonly onAssetCandidate: (
				listener: (candidate: ChatGptAssetCandidateSchema.Type) => void,
			) => () => void;
		};
		readonly clipboard: {
			readonly writeText: (text: string) => Promise<void>;
		};
		readonly cli: {
			readonly status: () => Promise<InstallationStatus>;
			readonly install: () => Promise<InstallationStatus>;
			readonly replace: () => Promise<InstallationStatus>;
			readonly uninstall: () => Promise<InstallationStatus>;
			readonly completion: {
				readonly status: () => Promise<CompletionStatus>;
				readonly install: () => Promise<CompletionStatus>;
				readonly replace: () => Promise<CompletionStatus>;
				readonly uninstall: () => Promise<CompletionStatus>;
			};
		};
		readonly launcher: {
			readonly readLastPackageId: () => Promise<LastPackageIdSchema.Type | null>;
			readonly writeLastPackageId: (packageId: LastPackageIdSchema.Type) => Promise<void>;
		};
		readonly editor: {
			readonly status: () => Promise<EditorProjectTransport.ServiceStatus>;
			readonly awaitIdle: () => Promise<EditorProjectTransport.Result<void>>;
			readonly buildProject: (
				request: EditorProjectTransport.BuildRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Build>>;
			readonly readProjectBuild: (
				request: EditorProjectTransport.ReadBuildRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.BuildContent>>;
			readonly saveProjectBuild: (
				request: EditorProjectTransport.ReadBuildRequest,
			) => Promise<EditorProjectTransport.Result<boolean>>;
			readonly createProject: (
				request: EditorProjectTransport.CreateProjectRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly deleteProject: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly deleteItem: (
				request: EditorProjectTransport.DeleteItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly deleteResource: (
				request: EditorProjectTransport.DeleteResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly importJsonDirectory: () => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.Descriptor | null>
			>;
			readonly exportJsonDirectory: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.SourceExport | null>>;
			readonly listProjects: () => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.ProjectCandidate>
				>
			>;
			readonly openExportDirectory: () => Promise<EditorProjectTransport.Result<void>>;
			readonly openProjectDirectory: (
				root: string,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly readProject: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project | null>>;
			readonly refreshProject: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly onProjectChanged: (listener: (projectId: string) => void) => () => void;
			readonly replaceConfig: (
				request: EditorProjectTransport.ReplaceConfigRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly replaceResource: (
				request: EditorProjectTransport.ReplaceResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly saveResource: (
				request: EditorProjectTransport.SaveResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly upsertItem: (
				request: EditorProjectTransport.UpsertItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly upsertResources: (
				request: EditorProjectTransport.UpsertResourcesRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly listNotes: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<ReadonlyArray<EditorProjectTransport.Note>>>;
			readonly createNote: (
				request: EditorProjectTransport.CreateNoteRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Note>>;
			readonly updateNote: (
				request: EditorProjectTransport.UpdateNoteRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Note>>;
			readonly deleteNote: (
				request: EditorProjectTransport.NoteKeyRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly listBoardScenarios: (
				projectId: string,
			) => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.BoardScenarioDescriptor>
				>
			>;
			readonly readBoardScenario: (
				request: EditorProjectTransport.BoardScenarioKeyRequest,
			) => Promise<
				EditorProjectTransport.Result<EditorProjectTransport.BoardScenario | null>
			>;
			readonly writeBoardScenario: (
				request: EditorProjectTransport.WriteBoardScenarioRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.BoardScenario>>;
			readonly deleteBoardScenario: (
				request: EditorProjectTransport.BoardScenarioKeyRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly readVersionStatus: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionStatus>>;
			readonly listVersions: (
				projectId: string,
			) => Promise<
				EditorProjectTransport.Result<
					ReadonlyArray<EditorProjectTransport.VersionDescriptor>
				>
			>;
			readonly diffVersions: (
				request: EditorProjectTransport.VersionDiffRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDiff>>;
			readonly createVersion: (
				request: EditorProjectTransport.VersionCommitRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDescriptor>>;
			readonly checkoutVersion: (
				request: EditorProjectTransport.VersionCheckoutRequest,
			) => Promise<EditorProjectTransport.Result<void>>;
			readonly updateVersionTag: (
				request: EditorProjectTransport.VersionTagRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.VersionDescriptor>>;
		};
		readonly editorMcp: {
			readonly readOverview: () => Promise<EditorMcpOverviewSchema.Type>;
			readonly configure: (
				configuration: EditorMcpConfigurationSchema.Type,
			) => Promise<EditorMcpOverviewSchema.Type>;
			readonly command: (
				command: EditorMcpCommandSchema.Type,
			) => Promise<EditorMcpCommandResultSchema.Type>;
			readonly onOverviewChanged: (
				listener: (overview: EditorMcpOverviewSchema.Type) => void,
			) => () => void;
			readonly setProjectContext: (projectId: string) => Promise<void>;
			readonly clearProjectContext: (projectId: string) => Promise<void>;
			readonly onVersionCheckoutRequested: (
				listener: (request: EditorMcpVersionCheckoutRequest) => Promise<void>,
			) => () => void;
		};
		readonly save: {
			readonly read: (key: SaveKey) => Promise<Uint8Array | null>;
			readonly write: (key: SaveKey, bytes: Uint8Array) => Promise<void>;
			readonly clear: (key: SaveKey) => Promise<void>;
		};
		readonly diagnostics: {
			readonly write: (record: DiagnosticRecord) => Promise<void>;
			readonly openDirectory: () => Promise<void>;
		};
		readonly userData: {
			readonly openDirectory: () => Promise<void>;
		};
		readonly window: {
			readonly readMode: () => Promise<WindowModeSchema.Type>;
			readonly writeMode: (mode: WindowModeSchema.Type) => Promise<void>;
			readonly onModeChanged: (listener: (mode: WindowModeSchema.Type) => void) => () => void;
		};
		readonly lifecycle: {
			readonly waitUntilVisible: () => Promise<number>;
			readonly onBeforeClose: (listener: () => Promise<void>) => () => void;
			readonly onBeforeCloseReady: (listener: () => Promise<void>) => () => void;
			readonly onCloseFailed: (listener: (error: unknown) => void) => () => void;
			readonly requestClose: () => Promise<void>;
			readonly forceClose: () => void;
		};
	}
}

declare global {
	interface Window {
		readonly arkini: ArkiniElectronApi.Api;
	}
}
