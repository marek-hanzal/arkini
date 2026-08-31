import { Data } from "effect";

export class FilesystemWriteError extends Data.TaggedError("FilesystemWriteError")<{
	readonly operation: "lock" | "recover" | "remove-file" | "replace-file" | "write-files";
	readonly message: string;
	readonly cause?: unknown;
	readonly recovery?: string;
}> {}
