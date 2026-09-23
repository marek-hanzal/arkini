import { z } from "zod";

import { OutcomeSchema } from "~/outcome/schema/OutcomeSchema";

import { RollTypeSchema } from "./RollTypeSchema";

/**
 * An outcome roll that provides its outcome whenever its rules allow it.
 */
export const GuaranteedRollSchema = z
	.object({
		type: RollTypeSchema.extract([
			"Guaranteed",
		]),
		/**
		 * One or more outcomes emitted when this roll succeeds.
		 */
		outcome: z
			.tuple(
				[
					OutcomeSchema,
				],
				OutcomeSchema,
			)
			.describe("One or more outcomes emitted when this roll succeeds."),
	})
	.strict()
	.meta({
		id: "roll.GuaranteedSchema",
		description: "A roll that guarantees its outcome when its rules allow it.",
	});

export type GuaranteedRollSchema = typeof GuaranteedRollSchema;

export namespace GuaranteedRollSchema {
	export type Type = z.infer<GuaranteedRollSchema>;
}
