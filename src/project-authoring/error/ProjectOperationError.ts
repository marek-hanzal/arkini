import { Data } from "effect";

/** One editor project operation could not safely validate or address its requested value. */
export class ProjectOperationError extends Data.TaggedError("EditorProjectError")<{
	readonly reason:
		| "invalid-asset"
		| "invalid-config"
		| "invalid-item"
		| "invalid-resource-id"
		| "project-not-found";
	readonly message: string;
	readonly cause?: unknown;
}> {}
