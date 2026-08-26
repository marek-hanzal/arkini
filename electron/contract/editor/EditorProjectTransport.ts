/** Serializable editor transport contracts. Domain payloads stay unknown until each process validates them. */
export namespace EditorProjectTransport {
	export type Operation =
		| "await-idle"
		| "build-project"
		| "checkout-version"
		| "create-project"
		| "create-note"
		| "create-version"
		| "delete-project"
		| "delete-item"
		| "delete-resource"
		| "delete-note"
		| "delete-board-scenario"
		| "diff-versions"
		| "export-json-directory"
		| "import-json-directory"
		| "list-board-scenarios"
		| "list-notes"
		| "list-projects"
		| "list-versions"
		| "open-export-directory"
		| "read-project"
		| "read-project-build"
		| "refresh-project"
		| "read-version-status"
		| "read-board-scenario"
		| "replace-config"
		| "replace-resource"
		| "save-resource"
		| "upsert-item"
		| "upsert-resource"
		| "update-version-tag"
		| "update-note"
		| "write-board-scenario";

	export type ServiceStatus =
		| {
				readonly type: "ready";
		  }
		| {
				readonly type: "unavailable";
				readonly message: string;
		  };

	export interface Failure {
		readonly operation: Operation;
		readonly message: string;
		readonly diagnostics?: Array<unknown>;
	}

	export type Result<Value> =
		| {
				readonly type: "success";
				readonly value: Value;
		  }
		| {
				readonly type: "failure";
				readonly error: Failure;
		  };

	export interface Descriptor {
		readonly projectId: string;
		readonly title: string;
		readonly version: string;
		readonly createdAtMs: number;
		readonly updatedAtMs: number;
	}

	export interface Commit extends Descriptor {
		readonly previousRevision: number;
		readonly revision: number;
		readonly config: unknown;
	}

	export interface Resource {
		readonly id: string;
		readonly mime: string;
		readonly bytes: Uint8Array;
	}

	export interface Project extends Descriptor {
		readonly revision: number;
		readonly config: unknown;
		readonly resources: ReadonlyArray<Resource>;
	}

	export interface Build {
		readonly projectId: string;
		readonly revision: number;
		readonly contentHash: string;
		readonly filename: string;
		readonly signatureFilename?: string;
		readonly version: string;
		readonly game: string;
		readonly bytes: number;
		readonly diagnostics: ReadonlyArray<unknown>;
	}

	export interface BuildContent {
		readonly bytes: Uint8Array;
		readonly signature?: unknown;
	}

	export interface BuildRequest {
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly signKey?: string;
	}

	export interface ReadBuildRequest {
		readonly contentHash: string;
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly signatureFilename?: string;
	}

	export interface SourceExport {
		readonly json: number;
		readonly projectDirectory: string;
		readonly resources: number;
		readonly revision: number;
		readonly root: string;
	}

	export interface BoardScenarioDescriptor {
		readonly projectId: string;
		readonly name: string;
		readonly projectRevision: number;
		readonly version: string;
		readonly createdAtMs: number;
		readonly updatedAtMs: number;
	}

	export interface BoardScenario extends BoardScenarioDescriptor {
		readonly bytes: Uint8Array;
	}

	export interface Note {
		readonly noteId: string;
		readonly projectId: string;
		readonly content: string;
		readonly createdAtMs: number;
		readonly updatedAtMs: number;
	}

	export interface CreateNoteRequest {
		readonly projectId: string;
		readonly content: string;
	}

	export interface NoteKeyRequest {
		readonly projectId: string;
		readonly noteId: string;
	}

	export interface UpdateNoteRequest extends NoteKeyRequest {
		readonly content: string;
	}

	export interface BoardScenarioKeyRequest {
		readonly projectId: string;
		readonly name: string;
	}

	export interface WriteBoardScenarioRequest extends BoardScenarioKeyRequest {
		readonly expectedRevision: number;
		readonly bytes: Uint8Array;
	}

	export interface CreateProjectRequest {
		readonly version: string;
		readonly config: unknown;
		readonly resources: ReadonlyArray<unknown>;
	}

	export interface UpsertItemRequest {
		readonly expectedRevision?: number;
		readonly projectId: string;
		readonly item: unknown;
	}

	export interface DeleteItemRequest {
		readonly projectId: string;
		readonly itemUid: string;
		readonly expectedRevision: number;
		readonly force: boolean;
	}

	export interface DeleteResourceRequest {
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly resourceId: string;
	}

	export interface ReplaceConfigRequest {
		readonly projectId: string;
		readonly expectedRevision: number;
		readonly config: unknown;
	}

	export interface ReplaceResourceRequest {
		readonly config: unknown;
		readonly currentId: string;
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly resource: unknown;
	}

	export interface SaveResourceRequest {
		readonly expectedRevision: number;
		readonly overwrite: boolean;
		readonly projectId: string;
		readonly resource: unknown;
	}

	export interface UpsertResourcesRequest {
		readonly projectId: string;
		readonly resources: ReadonlyArray<unknown>;
	}

	export interface VersionDescriptor {
		readonly arkini: string;
		readonly arkpackVersion: string;
		readonly body?: string;
		readonly createdAtMs: number;
		readonly parentVersionId?: string;
		readonly projectId: string;
		readonly sourceRevision: number;
		readonly subject: string;
		readonly tag?: string;
		readonly versionId: string;
	}

	export interface VersionStatus {
		readonly canCommit: boolean;
		readonly currentBaseVersionId?: string;
		readonly currentFingerprint: string;
		readonly dirty: boolean;
		readonly versionCount: number;
	}

	export type VersionReference =
		| {
				readonly type: "current";
		  }
		| {
				readonly type: "version";
				readonly versionId: string;
		  };

	export interface VersionCommitRequest {
		readonly body?: string;
		readonly expectedFingerprint?: string;
		readonly projectId: string;
		readonly subject: string;
		readonly tag?: string;
	}

	export interface VersionCheckoutRequest {
		readonly expectedFingerprint?: string;
		readonly projectId: string;
		readonly versionId: string;
	}

	export interface VersionTagRequest {
		readonly projectId: string;
		readonly tag?: string;
		readonly versionId: string;
	}

	export interface VersionDiffRequest {
		readonly projectId: string;
		readonly from: VersionReference;
		readonly to: VersionReference;
	}

	export interface VersionValueChange {
		readonly path: string;
		readonly before?: unknown;
		readonly after?: unknown;
	}

	export interface VersionItemDiff {
		readonly change: "added" | "changed" | "deleted";
		readonly uid: string;
		readonly values: ReadonlyArray<VersionValueChange>;
	}

	export interface VersionBinaryDiff {
		readonly change: "added" | "changed" | "deleted";
		readonly id: string;
	}

	export interface VersionDiff {
		readonly from: VersionReference;
		readonly to: VersionReference;
		readonly hasChanges: boolean;
		readonly project: ReadonlyArray<VersionValueChange>;
		readonly items: ReadonlyArray<VersionItemDiff>;
		readonly resources: ReadonlyArray<VersionBinaryDiff>;
		readonly scenarios: ReadonlyArray<VersionBinaryDiff>;
	}
}
