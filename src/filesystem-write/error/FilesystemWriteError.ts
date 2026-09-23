import { Data } from "effect";

export class FilesystemWriteError extends Data.TaggedError("FilesystemWriteError")<{
	readonly operation: "lock" | "remove-file" | "replace-file";
	readonly message: string;
	readonly cause?: unknown;
}> {}
