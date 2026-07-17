import { Data } from "effect";

export class AppearanceAccentError extends Data.TaggedError("AppearanceAccentError")<{
	readonly operation: "read" | "write";
	readonly cause: unknown;
}> {}
