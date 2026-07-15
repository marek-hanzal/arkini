import { Data } from "effect";

/** A runtime command received a space that is not a non-negative integer. */
export class SpaceInvalidError extends Data.TaggedError("SpaceInvalidError")<{
	space: number;
}> {}
