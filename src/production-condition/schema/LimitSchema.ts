import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { TypeSchema } from "./TypeSchema";

/** Checks whether one canonical item's live quantity has reached its global authored limit. */
export const LimitSchema = z
	.object({
		type: TypeSchema.extract([
			"Limit",
		]).describe("Checks whether an item's global quantity limit is reached."),
		itemId: IdSchema.describe(
			"The exact item whose maxCount is compared with its live quantity across every location.",
		),
	})
	.strict()
	.meta({
		id: "when.LimitSchema",
		description:
			"True when an item's global live quantity reaches maxCount; false for an uncapped item. Future output reservations are excluded.",
	});

export type LimitSchema = typeof LimitSchema;

export namespace LimitSchema {
	export type Type = z.infer<LimitSchema>;
}
