import { z } from "zod";
import {
	CraftRecipeFragmentSchema,
	CraftRecipeSchema,
} from "~/v0/game/config/schema/GameCraftRecipeSchema";
import {
	IdSchema,
	ItemStoragePolicySchema,
	NonNegativeIntegerSchema,
	PositiveIntegerSchema,
} from "~/v0/game/config/schema/GameConfigScalarSchemas";
import { GameEffectSchema } from "~/v0/game/config/schema/GameEffectSchema";
import { MergeRuleSchema } from "~/v0/game/config/schema/GameMergeRuleSchema";
import { ProducerFragmentSchema, ProducerSchema } from "~/v0/game/config/schema/GameProducerSchema";
import { RemoveBySchema } from "~/v0/game/config/schema/GameRemoveBySchema";
import { StashFragmentSchema, StashSchema } from "~/v0/game/config/schema/GameStashSchema";

export const ItemSchema = z
	.object({
		assetIds: z.array(IdSchema).min(1),
		name: z.string().min(1),
		tier: NonNegativeIntegerSchema.default(0),
		maxStackSize: PositiveIntegerSchema.default(10),
		maxCount: PositiveIntegerSchema.optional(),
		storage: ItemStoragePolicySchema,
		description: z.string(),
		label: z.string().optional(),
		tags: z.array(z.string().min(1)).default([]),
		effects: z.array(GameEffectSchema).optional(),
		merges: z.array(MergeRuleSchema).optional(),
		removeBy: z.array(RemoveBySchema).optional(),
		craft: CraftRecipeSchema.optional(),
		producer: ProducerSchema.optional(),
		stash: StashSchema.optional(),
	})
	.strict();

export const ItemFragmentSchema = ItemSchema.extend({
	assetIds: z.array(IdSchema).min(1).optional(),
	craft: CraftRecipeFragmentSchema.optional(),
	producer: ProducerFragmentSchema.optional(),
	stash: StashFragmentSchema.optional(),
});
