import { Data } from "effect";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";

/** A Board-relative query was evaluated without one concrete Board origin. */
export class BoardQueryOriginUnavailableError extends Data.TaggedError(
	"BoardQueryOriginUnavailableError",
)<{
	origin: GridLocationSchema.Type;
}> {}
