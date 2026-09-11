/** Serializable editor transport contracts. Domain payloads stay unknown until each process validates them. */
export namespace EditorProjectTransport {
	export interface BuildVersion {
		readonly major: number;
		readonly minor: number;
		readonly suffix?: string;
	}

	export type Operation =
		| "await-idle"
		| "build-project"
		| "save-build-version"
		| "create-project"
		| "create-note"
		| "delete-project"
		| "delete-item"
		| "delete-resource"
		| "delete-note"
		| "export-json-directory"
		| "import-json-directory"
		| "list-notes"
		| "list-projects"
		| "open-project-directory"
		| "optimize-resources"
		| "read-project"
		| "read-project-build"
		| "refresh-project"
		| "replace-config"
		| "replace-resource"
		| "save-resource"
		| "save-project-build"
		| "upsert-item"
		| "upsert-resource"
		| "update-note";

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
		readonly version: BuildVersion;
		readonly createdAtMs: number;
		readonly updatedAtMs: number;
	}

	export type ProjectCandidate =
		| {
				readonly type: "valid";
				readonly ownership: "external" | "managed";
				readonly project: Descriptor;
		  }
		| {
				readonly type: "invalid";
				readonly root: string;
				readonly title: string;
				readonly validationError: string;
		  };

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
		readonly version: string;
		readonly projectId: string;
		readonly revision: number;
		readonly contentHash: string;
		readonly size: number;
		readonly diagnostics: ReadonlyArray<unknown>;
	}

	export interface BuildContent {
		readonly bytes: Uint8Array;
	}

	export interface BuildRequest {
		readonly expectedVersion: BuildVersion;
		readonly expectedRevision: number;
		readonly projectId: string;
	}

	export interface SaveBuildVersionRequest {
		readonly projectId: string;
		readonly expectedRevision: number;
		readonly version: BuildVersion;
	}

	export interface ReadBuildRequest {
		readonly contentHash: string;
		readonly expectedRevision: number;
		readonly projectId: string;
	}

	export interface Note {
		readonly noteId: string;
		readonly projectId: string;
		readonly content: string;
		readonly itemUids: ReadonlyArray<string>;
		readonly resourceIds: ReadonlyArray<string>;
		readonly createdAtMs: number;
		readonly updatedAtMs: number;
	}

	export interface CreateNoteRequest {
		readonly projectId: string;
		readonly content: string;
		readonly itemUids: ReadonlyArray<string>;
		readonly resourceIds: ReadonlyArray<string>;
	}

	export interface NoteKeyRequest {
		readonly projectId: string;
		readonly noteId: string;
	}

	export interface DeleteNoteRequest extends NoteKeyRequest {
		readonly expectedUpdatedAtMs: number;
	}

	export interface UpdateNoteRequest extends DeleteNoteRequest {
		readonly content: string;
		readonly itemUids: ReadonlyArray<string>;
		readonly resourceIds: ReadonlyArray<string>;
	}

	export interface CreateProjectRequest {
		readonly version: BuildVersion;
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

	export interface OptimizeResourcesRequest {
		readonly expectedRevision: number;
		readonly projectId: string;
		readonly resourceIds: ReadonlyArray<string>;
	}

	export interface OptimizeResourcesProgress {
		readonly completedResourceCount: number;
		readonly expectedRevision: number;
		readonly phase: "optimizing" | "saving";
		readonly projectId: string;
		readonly totalResourceCount: number;
	}

	export interface OptimizeResourcesResult {
		readonly optimizedResourceCount: number;
		readonly originalBytes: number;
		readonly optimizedBytes: number;
		readonly processedResourceCount: number;
		readonly project: Project;
	}
}
