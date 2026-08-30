import { Data } from "effect";

export class AppearanceThemeError extends Data.TaggedError("AppearanceThemeError")<{
	readonly operation: "read" | "write";
	readonly cause: unknown;
}> {}
