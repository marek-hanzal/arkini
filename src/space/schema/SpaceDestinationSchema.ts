import { IdSchema } from "~/game-value/schema/IdSchema";
import { z } from "zod";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

/** An authored destination; previous is resolved from committed navigation history. */
export const SpaceDestinationSchema = z
	.union([
		NonNegativeIntegerSchema,
		z.literal("previous"),
		z
			.object({
				type: z.literal("inventory"),
				templateUid: IdSchema,
			})
			.strict(),
	])
	.meta({
		id: "SpaceDestinationSchema",
		description:
			"An exact Board space, previous navigation destination, or Inventory: a template-initialized Space owned by the live item instance.",
	});
export type SpaceDestinationSchema = typeof SpaceDestinationSchema;
export namespace SpaceDestinationSchema {
	export type Type = z.infer<SpaceDestinationSchema>;
}
