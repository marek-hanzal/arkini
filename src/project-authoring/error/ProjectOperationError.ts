import { Data } from "effect";

/** One editor project operation could not safely validate or address its requested value. */
export class ProjectOperationError extends Data.TaggedError("EditorProjectError")<{
	readonly reason:
		| "invalid-artwork"
		| "invalid-config"
		| "invalid-item"
		| "invalid-resource-title"
		| "project-not-found";
	readonly message: string;
	readonly cause?: unknown;
}> {}
