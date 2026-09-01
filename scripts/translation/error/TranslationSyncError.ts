import { Data } from "effect";

/** Translation extraction or catalog persistence could not complete safely. */
export class TranslationSyncError extends Data.TaggedError("TranslationSyncError")<{
	readonly cause?: unknown;
	readonly message: string;
	readonly operation: "discover" | "parse" | "read" | "write";
	readonly path: string;
}> {}
