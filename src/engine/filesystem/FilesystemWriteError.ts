import { Data } from "effect";

export class FilesystemWriteError extends Data.TaggedError("FilesystemWriteError")<{
	readonly operation: "lock" | "recover" | "write-file" | "write-files";
	readonly message: string;
	readonly cause?: unknown;
	readonly recovery?: string;
}> {}

export const withFilesystemWriteRecovery = (message: string, cause: unknown) =>
	cause instanceof FilesystemWriteError && cause.recovery !== undefined
		? `${message} Recovery was preserved at ${cause.recovery}.`
		: message;
