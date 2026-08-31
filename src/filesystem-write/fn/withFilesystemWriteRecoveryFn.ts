import { FilesystemWriteError } from "~/filesystem-write/error/FilesystemWriteError";

/** Preserves the exact recovery artifact location when adapting write failures. */
export const withFilesystemWriteRecoveryFn = (message: string, cause: unknown) =>
	cause instanceof FilesystemWriteError && cause.recovery !== undefined
		? `${message} Recovery was preserved at ${cause.recovery}.`
		: message;
