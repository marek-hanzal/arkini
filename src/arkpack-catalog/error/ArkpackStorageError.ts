import { Data } from "effect";

export class ArkpackStorageError extends Data.TaggedError("ArkpackStorageError")<{
	readonly operation: "install" | "list" | "open-user-directory" | "read" | "remove";
	readonly cause: unknown;
}> {}
