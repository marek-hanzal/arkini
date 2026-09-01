import { Data } from "effect";

/** The checked translation catalogs differ from their reconciled source keys. */
export class TranslationOutOfSyncError extends Data.TaggedError("TranslationOutOfSyncError")<{
	readonly paths: readonly string[];
}> {}
