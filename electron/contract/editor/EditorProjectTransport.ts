/** Serializable editor transport contracts. Domain payloads stay unknown until each process validates them. */
export namespace EditorProjectTransport {
	export type Operation =
		| "await-idle"
		| "create-project"
		| "list-projects"
		| "read-project"
		| "replace-config"
		| "replace-resource"
		| "upsert-item"
		| "upsert-resource";

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

	export interface CreateProjectRequest {
		readonly projectId: string;
		readonly version: string;
		readonly config: unknown;
		readonly resources: ReadonlyArray<unknown>;
	}

	export interface UpsertItemRequest {
		readonly projectId: string;
		readonly item: unknown;
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

	export interface UpsertResourcesRequest {
		readonly projectId: string;
		readonly resources: ReadonlyArray<unknown>;
	}
}
