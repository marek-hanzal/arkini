/** Serializable editor transport contracts. Domain payloads stay unknown until each process validates them. */
export namespace EditorProjectTransport {
	export type Operation =
		| "await-idle"
		| "create-project"
		| "delete-project"
		| "delete-item"
		| "delete-board-scenario"
		| "export-json-directory"
		| "import-json-directory"
		| "list-board-scenarios"
		| "list-projects"
		| "open-export-directory"
		| "read-project"
		| "read-board-scenario"
		| "replace-config"
		| "replace-resource"
		| "save-resource"
		| "upsert-item"
		| "upsert-resource"
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
		readonly revision: number;
		readonly config: unknown;
	}

	export interface Resource {
		readonly id: string;
		readonly mime: string;
		readonly bytes: Uint8Array;
	}

	export interface Project extends Commit {
		readonly resources: ReadonlyArray<Resource>;
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

	export interface BoardScenarioKeyRequest {
		readonly projectId: string;
		readonly name: string;
	}

	export interface WriteBoardScenarioRequest extends BoardScenarioKeyRequest {
		readonly expectedRevision: number;
		readonly bytes: Uint8Array;
	}

	export interface CreateProjectRequest {
		readonly projectId: string;
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
}
