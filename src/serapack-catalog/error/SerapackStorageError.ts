import { Data } from "effect";

export class SerapackStorageError extends Data.TaggedError("SerapackStorageError")<{
	readonly operation: "install" | "list" | "open-user-directory" | "read" | "remove";
	readonly cause: unknown;
}> {}
