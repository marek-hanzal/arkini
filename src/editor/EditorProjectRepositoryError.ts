import { Data } from "effect";

export type EditorProjectRepositoryOperation =
	| "await-idle"
	| "checkout-version"
	| "create-version"
	| "create-project"
	| "delete-project"
	| "delete-item"
	| "delete-resource"
	| "delete-board-scenario"
	| "diff-versions"
	| "export-json-directory"
	| "import-json-directory"
	| "list-board-scenarios"
	| "list-projects"
	| "list-versions"
	| "open-export-directory"
	| "read-project"
	| "read-version-status"
	| "read-board-scenario"
	| "replace-config"
	| "replace-resource"
	| "save-resource"
	| "upsert-item"
	| "upsert-resource"
	| "update-version-tag"
	| "write-board-scenario";

/** One canonical editor-project repository operation failed. */
export class EditorProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: EditorProjectRepositoryOperation;
	readonly message: string;
	readonly cause?: unknown;
}> {}
