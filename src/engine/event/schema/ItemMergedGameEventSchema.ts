import { z } from "zod";

import { GameEventEnumSchema } from "./GameEventEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ActionEnumSchema } from "~/engine/merge/schema/ActionEnumSchema";
import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";

export const ItemMergedGameEventSchema = z
	.object({
		type: GameEventEnumSchema.extract([
			"ItemMerged",
		]),
		sourceItemId: IdSchema,
		sourceCanonicalItemId: IdSchema,
		targetItemId: IdSchema,
		targetCanonicalItemId: IdSchema,
		action: ActionEnumSchema,
		effect: EffectEnumSchema,
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
