import { Data } from "effect";

export class GameSaveStorageError extends Data.TaggedError("GameSaveStorageError")<{
	readonly operation: "clear" | "read" | "write";
	readonly cause: unknown;
}> {}
