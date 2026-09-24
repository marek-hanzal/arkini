import { Data } from "effect";

/** Receiver transport cannot begin before the player has left a space successfully. */
export class PreviousSpaceUnavailableError extends Data.TaggedError(
	"PreviousSpaceUnavailableError",
)<{}> {}
