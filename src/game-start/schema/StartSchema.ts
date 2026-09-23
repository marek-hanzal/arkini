import { z } from "zod";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";

/** Authored initial spaces bind reusable templates without duplicating their layout. */
export const StartSchema = z
	.object({
		currentSpace: NonNegativeIntegerSchema.describe(
			"The board space presented when a new game starts.",
		),
		spaces: z
			.array(
				z
					.object({
						space: NonNegativeIntegerSchema,
						templateUid: IdSchema,
					})
					.strict(),
			)
			.refine(
				(spaces) => new Set(spaces.map((entry) => entry.space)).size === spaces.length,
				"Each initial space must have only one template.",
			),
	})
	.strict()
	.meta({
		id: "StartSchema",
		description: "Template assignments for the initial world spaces.",
	});
export type StartSchema = typeof StartSchema;
export namespace StartSchema {
	export type Type = z.infer<StartSchema>;
}
