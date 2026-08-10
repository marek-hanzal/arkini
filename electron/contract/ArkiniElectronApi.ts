import type { AppearanceAccentSchema } from "./appearance/AppearanceAccentSchema";
import type { AppearanceThemeSchema } from "./appearance/AppearanceThemeSchema";
import type { CheatAvailabilitySchema } from "./cheat/CheatAvailabilitySchema";
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
		saveRead: "arkini:save:read",
		saveWrite: "arkini:save:write",
		saveClear: "arkini:save:clear",
		appearanceRead: "arkini:appearance:read",
		appearanceWrite: "arkini:appearance:write",
		appearanceAccentRead: "arkini:appearance:accent:read",
		appearanceAccentWrite: "arkini:appearance:accent:write",
		cheatAvailabilityRead: "arkini:cheats:available:read",
		cheatAvailabilityWrite: "arkini:cheats:available:write",
		launcherLastPackageIdRead: "arkini:launcher:last-package:read",
		launcherLastPackageIdWrite: "arkini:launcher:last-package:write",
		editorStatus: "arkini:editor:status",
		editorAwaitIdle: "arkini:editor:await-idle",
		editorProjectCreate: "arkini:editor:project:create",
		editorProjectList: "arkini:editor:project:list",
		editorProjectRead: "arkini:editor:project:read",
		editorProjectReplaceConfig: "arkini:editor:project:replace-config",
		editorProjectReplaceResource: "arkini:editor:project:replace-resource",
		editorProjectUpsertItem: "arkini:editor:project:upsert-item",
		editorProjectUpsertResources: "arkini:editor:project:upsert-resources",
		editorMcpPortRead: "arkini:editor:mcp:port:read",
		editorMcpPortWrite: "arkini:editor:mcp:port:write",
		editorMcpPortCheck: "arkini:editor:mcp:port:check",
		editorMcpStatus: "arkini:editor:mcp:status",
		editorMcpActivate: "arkini:editor:mcp:activate",
		editorMcpProjectContextSet: "arkini:editor:mcp:project-context:set",
		editorMcpProjectContextClear: "arkini:editor:mcp:project-context:clear",
		diagnosticsWrite: "arkini:diagnostics:write",
		diagnosticsOpenDirectory: "arkini:diagnostics:open-directory",
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

	export interface ArkpackDescriptor {
		readonly packageId: string;
		readonly hash: string;
		readonly gameId: string;
		readonly title: string;
		readonly game: string;
		readonly trust:
			| {
					readonly type: "official";
					readonly keyId: string;
			  }
			| {
					readonly type: "external";
					readonly reason: "unsigned" | "unknown-key";
			  }
			| {
					readonly type: "invalid";
					readonly reason: "malformed-signature" | "invalid-signature";
					readonly keyId?: string;
			  };
		readonly source: "imported";
		readonly filename?: string;
		readonly importedAtMs?: number;
	}

	export interface ArkpackRecord {
		readonly descriptor: ArkpackDescriptor;
		readonly bytes: Uint8Array;
	}

	export interface SaveKey {
		readonly packageId: string;
		readonly contentHash: string;
	}

	export interface Api {
		readonly arkpack: {
			readonly list: () => Promise<ReadonlyArray<ArkpackDescriptor>>;
			readonly read: (packageId: string) => Promise<ArkpackRecord | null>;
			readonly install: (record: ArkpackRecord) => Promise<void>;
			readonly remove: (packageId: string) => Promise<void>;
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
			readonly listProjects: () => Promise<
				EditorProjectTransport.Result<ReadonlyArray<EditorProjectTransport.Descriptor>>
			>;
			readonly readProject: (
				projectId: string,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project | null>>;
			readonly replaceConfig: (
				request: EditorProjectTransport.ReplaceConfigRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly replaceResource: (
				request: EditorProjectTransport.ReplaceResourceRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
			readonly upsertItem: (
				request: EditorProjectTransport.UpsertItemRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Commit>>;
			readonly upsertResources: (
				request: EditorProjectTransport.UpsertResourcesRequest,
			) => Promise<EditorProjectTransport.Result<EditorProjectTransport.Project>>;
		};
		readonly editorMcp: {
			readonly status: () => Promise<EditorMcpStatus>;
			readonly activate: () => Promise<EditorMcpStatus>;
			readonly setProjectContext: (projectId: string) => Promise<void>;
			readonly clearProjectContext: (projectId: string) => Promise<void>;
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
