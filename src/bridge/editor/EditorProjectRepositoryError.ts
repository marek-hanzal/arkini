import { Data } from "effect";

export type EditorProjectRepositoryOperation =
	| "create-project"
	| "list-projects"
	| "read-project"
	| "upsert-item"
	| "upsert-resource";

/** One canonical editor-project repository operation failed. */
export class EditorProjectRepositoryError extends Data.TaggedError("EditorProjectRepositoryError")<{
	readonly operation: EditorProjectRepositoryOperation;
	readonly message: string;
	readonly cause?: unknown;
}> {}
