import { Data } from "effect";

export class LastPackageIdError extends Data.TaggedError("LastPackageIdError")<{
	readonly operation: "read" | "write";
	readonly cause: unknown;
}> {}
