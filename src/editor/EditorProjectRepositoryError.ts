import { Data } from "effect";

export type EditorProjectRepositoryOperation =
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

/** One canonical editor-project repository operation failed. */
export class EditorProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: EditorProjectRepositoryOperation;
	readonly message: string;
	readonly cause?: unknown;
}> {}
