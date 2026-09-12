import { z } from "zod";
import { BaseSchema } from "~/item-action/schema/BaseSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** Selects one authored board space after its immediate requirements settle. */
export const SpaceActionSchema = z
	.object({
		...BaseSchema.shape,
		type: z.literal("space"),
		space: NonNegativeIntegerSchema.describe(
			"The board space selected after successful activation.",
		),
	})
	.strict()
	.meta({
		id: "itemAction.SpaceActionSchema",
		description: "An immediate action whose requirements settle atomically with navigation.",
	});
export type SpaceActionSchema = typeof SpaceActionSchema;
export namespace SpaceActionSchema {
	export type Type = z.infer<SpaceActionSchema>;
}
