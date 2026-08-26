import { Data } from "effect";

export type EditorProjectRepositoryOperation =
	| "await-idle"
	| "checkout-version"
	| "create-version"
	| "create-project"
	| "create-note"
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
	| "read-version-status"
	| "read-board-scenario"
	| "replace-config"
	| "replace-resource"
	| "refresh-project"
	| "save-resource"
	| "upsert-item"
	| "upsert-resource"
	| "update-version-tag"
	| "update-note"
	| "write-board-scenario";

/** One canonical editor-project repository operation failed. */
export class EditorProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: EditorProjectRepositoryOperation;
	readonly message: string;
	readonly cause?: unknown;
}> {}
