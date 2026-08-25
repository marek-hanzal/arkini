import type { AppearanceAccentSchema } from "./appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "./appearance/AppearanceThemeSchema";
import type { CheatAvailabilitySchema } from "./cheat/CheatAvailabilitySchema";
import type { CliInstallationStatus } from "./cli/CliInstallationStatus";
import type {
	ChatGptAssetCandidateSchema,
	ChatGptSurfaceSchema,
	ChatGptViewStateSchema,
} from "./chatgpt/ChatGptSurfaceSchema";
import type { LastPackageIdSchema } from "./launcher/LastPackageIdSchema";
import type { DiagnosticRecord } from "./diagnostics/DiagnosticRecord";
import type { EditorProjectTransport } from "./editor/EditorProjectTransport";
import type {
	EditorMcpPortAvailability,
	EditorMcpPortSchema,
	EditorMcpStatus,
} from "./editor/EditorMcpPortSchema";
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
		cliStatus: "arkini:cli:status",
		cliInstall: "arkini:cli:install",
		cliUninstall: "arkini:cli:uninstall",
		launcherLastPackageIdRead: "arkini:launcher:last-package:read",
		launcherLastPackageIdWrite: "arkini:launcher:last-package:write",
		editorStatus: "arkini:editor:status",
		editorAwaitIdle: "arkini:editor:await-idle",
		editorProjectCreate: "arkini:editor:project:create",
		editorProjectDelete: "arkini:editor:project:delete",
		editorProjectDeleteItem: "arkini:editor:project:delete-item",
		editorProjectDeleteResource: "arkini:editor:project:delete-resource",
		editorProjectExportJsonDirectory: "arkini:editor:project:export-json-directory",
		editorProjectImportJsonDirectory: "arkini:editor:project:import-json-directory",
		editorProjectList: "arkini:editor:project:list",
		editorProjectOpenExportDirectory: "arkini:editor:project:open-export-directory",
		editorProjectRead: "arkini:editor:project:read",
		editorProjectChanged: "arkini:editor:project:changed",
		editorProjectReplaceConfig: "arkini:editor:project:replace-config",
		editorProjectReplaceResource: "arkini:editor:project:replace-resource",
		editorProjectSaveResource: "arkini:editor:project:save-resource",
		editorProjectUpsertItem: "arkini:editor:project:upsert-item",
		editorProjectUpsertResources: "arkini:editor:project:upsert-resources",
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
		editorMcpPortRead: "arkini:editor:mcp:port:read",
		editorMcpPortWrite: "arkini:editor:mcp:port:write",
		editorMcpPortCheck: "arkini:editor:mcp:port:check",
		editorMcpStatus: "arkini:editor:mcp:status",
		editorMcpActivate: "arkini:editor:mcp:activate",
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
		readonly signature?: unknown;
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
		readonly cli: {
			readonly status: () => Promise<CliInstallationStatus>;
			readonly install: () => Promise<CliInstallationStatus>;
			readonly uninstall: () => Promise<CliInstallationStatus>;
		};
		readonly launcher: {
			readonly readLastPackageId: () => Promise<LastPackageIdSchema.Type | null>;
			readonly writeLastPackageId: (packageId: LastPackageIdSchema.Type) => Promise<void>;
		};
		readonly editor: {
			readonly status: () => Promise<EditorProjectTransport.ServiceStatus>;
			readonly awaitIdle: () => Promise<EditorProjectTransport.Result<void>>;
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
				EditorProjectTransport.Result<ReadonlyArray<EditorProjectTransport.Descriptor>>
			>;
			readonly openExportDirectory: () => Promise<EditorProjectTransport.Result<void>>;
			readonly readProject: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project | null>>;
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
			readonly status: () => Promise<EditorMcpStatus>;
			readonly activate: () => Promise<EditorMcpStatus>;
			readonly setProjectContext: (projectId: string) => Promise<void>;
			readonly clearProjectContext: (projectId: string) => Promise<void>;
			readonly onVersionCheckoutRequested: (
				listener: (request: EditorMcpVersionCheckoutRequest) => Promise<void>,
			) => () => void;
			readonly readPort: () => Promise<EditorMcpPortSchema.Type>;
			readonly writePort: (port: EditorMcpPortSchema.Type) => Promise<void>;
			readonly checkPort: (
				port: EditorMcpPortSchema.Type,
			) => Promise<EditorMcpPortAvailability>;
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
