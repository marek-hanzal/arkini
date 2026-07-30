import { Data } from "effect";

/** A validated arkpack cannot be represented safely as an editable source workspace. */
export class EditorProjectError extends Data.TaggedError("EditorProjectError")<{
	readonly reason:
		| "path-collision"
		| "project-not-found"
		| "unsafe-resource-id"
		| "unsupported-project-file";
	readonly message: string;
	readonly cause?: unknown;
}> {}
