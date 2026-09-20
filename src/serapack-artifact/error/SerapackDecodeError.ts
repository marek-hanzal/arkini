import { Data } from "effect";

/** One Serapack payload could not be decoded into the current strict structure. */
export class SerapackDecodeError extends Data.TaggedError("SerapackDecodeError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}
