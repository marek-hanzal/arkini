import { Data } from "effect";

/** A cheat-only command was invoked while this Game has Cheat mode disabled. */
export class CheatModeDisabledError extends Data.TaggedError("CheatModeDisabledError")<{
	readonly command: string;
}> {}
