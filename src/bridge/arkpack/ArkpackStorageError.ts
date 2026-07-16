import { Data } from "effect";

export class ArkpackStorageError extends Data.TaggedError("ArkpackStorageError")<{
	readonly operation: "install" | "list" | "read" | "remove";
	readonly cause: unknown;
}> {}
