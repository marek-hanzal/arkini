import { Data } from "effect";

export type EditorProjectRepositoryOperation =
	| "await-idle"
	| "create-project"
	| "delete-board-scenario"
	| "list-board-scenarios"
	| "list-projects"
	| "read-project"
	| "read-board-scenario"
	| "replace-config"
	| "replace-resource"
	| "upsert-item"
	| "upsert-resource"
	| "write-board-scenario";

/** One canonical editor-project repository operation failed. */
export class EditorProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: EditorProjectRepositoryOperation;
	readonly message: string;
	readonly cause?: unknown;
}> {}
