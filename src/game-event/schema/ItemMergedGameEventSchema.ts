import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";

export const ItemMergedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemMerged",
		]),
		sourceItemId: IdSchema,
		sourceCanonicalItemId: IdSchema,
		targetItemId: IdSchema,
		targetCanonicalItemId: IdSchema,
		action: SourceActionSchema,
		effect: TargetEffectSchema,
		resultCanonicalItemId: IdSchema.optional(),
	})
	.strict()
	.meta({
		id: "ItemMergedGameEventSchema",
		description: "Transient fact that one directional gameplay merge committed.",
	});

export type ItemMergedGameEventSchema = typeof ItemMergedGameEventSchema;

export namespace ItemMergedGameEventSchema {
	export type Type = z.infer<ItemMergedGameEventSchema>;
}
