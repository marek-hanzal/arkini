import { z } from "zod";

import { CraftInputSchema } from "~/v1/input/schema/CraftInputSchema";
import { LineSchema } from "./LineSchema";

/** One craft line whose authored material inputs cannot buffer extra quantity. */
export const CraftLineSchema = LineSchema.extend({
	input: z
		.tuple(
			[
				CraftInputSchema,
			],
			CraftInputSchema,
		)
		.describe("One or more craft input requirements with zero material capacity."),
}).meta({
	id: "CraftLineSchema",
	description: "A craft product line with zero-capacity material inputs.",
});

export type CraftLineSchema = typeof CraftLineSchema;

export namespace CraftLineSchema {
	export type Type = z.infer<CraftLineSchema>;
}
