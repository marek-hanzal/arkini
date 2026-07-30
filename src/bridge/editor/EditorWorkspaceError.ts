import { Data } from "effect";

/** One typed preload editor-workspace operation failed at the platform boundary. */
export class EditorWorkspaceError extends Data.TaggedError("EditorWorkspaceError")<{
	readonly operation: "create" | "list" | "open-directory" | "read";
	readonly cause: unknown;
}> {
	override get message(): string {
		const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `Editor workspace failed during ${this.operation}: ${causeMessage}`;
	}
}
