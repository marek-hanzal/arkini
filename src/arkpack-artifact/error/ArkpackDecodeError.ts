import { Data } from "effect";

/** One Arkpack payload could not be decoded into the current strict structure. */
export class ArkpackDecodeError extends Data.TaggedError("ArkpackDecodeError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}
