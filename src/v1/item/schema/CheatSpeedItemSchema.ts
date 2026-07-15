import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";

import { AssetSchema } from "./AssetSchema";
import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/**
 * An authored user-facing control for the global runtime session speed mode.
 *
 * The item owns no toggle state. Its two ordered assets project the root accelerated and normal modes.
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
					.describe("Exactly two ordered asset IDs: accelerated mode, then normal mode."),
			})
			.strict(),
	})
	.strict()
	.describe("An authored speed-cheat control with ordered accelerated and normal assets.")
	.meta({
		id: "CheatSpeedItemSchema",
		description: "An authored speed-cheat control with ordered accelerated and normal assets.",
	});

export type CheatSpeedItemSchema = typeof CheatSpeedItemSchema;

export namespace CheatSpeedItemSchema {
	export type Type = z.infer<CheatSpeedItemSchema>;
}
