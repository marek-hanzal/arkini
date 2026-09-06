import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

import { LocationScopeEnumSchema } from "./LocationScopeEnumSchema";
/** One live runtime item temporarily reserved by an active job. */
export const ReservedLocationSchema = z
	.object({
		/** Identifies this item as unavailable while retained by an active job. */
		scope: LocationScopeEnumSchema.extract([
			"Reserved",
		]),
		/** Stable identity of the active job retaining this item. */
		jobId: IdSchema.describe("The active job retaining this runtime item."),
		/** Input slot that reserved this material. */
		inputIndex: NonNegativeIntegerSchema.describe(
			"The zero-based material input that reserved this item.",
		),
	})
	.strict()
	.meta({
		id: "ReservedLocationSchema",
		description: "One live runtime item temporarily retained by an active job.",
	});

export type ReservedLocationSchema = typeof ReservedLocationSchema;

export namespace ReservedLocationSchema {
	export type Type = z.infer<ReservedLocationSchema>;
}
