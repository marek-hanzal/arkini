import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

import { AssetSchema } from "./AssetSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An authoring contract for a future speed-cheat item capability.
 *
 * Its two ordered asset sources represent the enabled and disabled states.
 */
export const CheatSpeedItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			"cheat:speed",
		]),
		asset: z
			.object({
				...AssetSchema.shape,
				source: z
					.tuple([
						IdSchema,
						IdSchema,
					])
					.describe(
						"Exactly two ordered asset IDs: speed cheat on, then speed cheat off.",
					),
			})
			.strict(),
	})
	.strict()
	.describe("An authored speed-cheat item definition with ordered on and off assets.")
	.meta({
		id: "CheatSpeedItemSchema",
		description: "An authored speed-cheat item definition with ordered on and off assets.",
	});

export type CheatSpeedItemSchema = typeof CheatSpeedItemSchema;

export namespace CheatSpeedItemSchema {
	export type Type = z.infer<CheatSpeedItemSchema>;
}
