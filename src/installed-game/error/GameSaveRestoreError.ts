import { Data } from "effect";

/** A selected snapshot cannot be restored; the current session remains available. */
export class GameSaveRestoreError extends Data.TaggedError("GameSaveRestoreError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}
