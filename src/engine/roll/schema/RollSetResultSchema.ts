import { z } from "zod";

import { DropSchema } from "~/engine/output/schema/DropSchema";

/**
 * Drop configurations selected by every roll in one selected roll set.
 *
 * The drops remain unresolved until the output layer evaluates their rules and
 * concrete quantities. An empty result is valid when every roll in the set
 * selects no drops.
 */
export const RollSetResultSchema = z
	.object({
		/**
		 * Unresolved drop configurations aggregated from the selected roll set.
		 */
		drop: z
			.array(DropSchema)
			.describe(
				"The unresolved drop configurations aggregated from every roll in one selected roll set.",
			),
	})
	.strict()
	.meta({
		id: "RollSetResultSchema",
		description:
			"The unresolved, intentionally possibly empty drop configurations selected by one roll set.",
	});

export type RollSetResultSchema = typeof RollSetResultSchema;

export namespace RollSetResultSchema {
	export type Type = z.infer<RollSetResultSchema>;
}
