import { z } from "zod";
import { ActivationInputSchema } from "./ActivationInputSchema";
import { ActivationRequirementSchema } from "./ActivationRequirementSchema";
import { GameAssetIdSchema } from "./GameAssetIdSchema";
import { GameCraftRecipeIdSchema } from "./GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { GameLootTableIdSchema } from "./GameLootTableIdSchema";
import { GameMergeDefinitionIdSchema } from "./GameMergeDefinitionIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";

const ItemMergeRuleSchema = z.object({
	id: GameMergeDefinitionIdSchema,
	withItemId: GameItemIdSchema,
	resultItemId: GameItemIdSchema,
	consumeSource: z.boolean().optional(),
	inputCount: z.literal(2).optional(),
	secret: z.boolean().optional(),
});

const ItemCraftRecipeSchema = z.object({
	id: GameCraftRecipeIdSchema,
	resultItemId: GameItemIdSchema,
	durationMs: NonNegativeIntegerSchema,
	inputs: z
		.array(
			z.object({
				itemId: GameItemIdSchema,
				quantity: PositiveIntegerSchema,
			}),
		)
		.min(1),
});

const ProducerDefinitionSchema = z.object({
	type: z.literal("producer"),
	trigger: z.literal("click"),
	placement: z.literal("board_then_inventory"),
	cooldownMs: PositiveIntegerSchema,
	outputTableId: GameLootTableIdSchema,
	inputs: ActivationInputSchema,
	requirements: ActivationRequirementSchema,
});

const StashDefinitionSchema = z.object({
	type: z.literal("stash"),
	trigger: z.literal("click"),
	placement: z.literal("board_then_inventory"),
	charges: PositiveIntegerSchema,
	onDepleted: z.union([
		z.literal("remove"),
		z.object({
			replaceWithItemId: GameItemIdSchema,
		}),
	]),
	outputTableId: GameLootTableIdSchema,
	inputs: ActivationInputSchema,
	requirements: ActivationRequirementSchema,
});

export const ItemDefinitionSchema = z.object({
	id: GameItemIdSchema,
	assetId: GameAssetIdSchema,
	code: z.string().min(1),
	name: z.string().min(1),
	tier: PositiveIntegerSchema,
	maxStackSize: PositiveIntegerSchema,
	description: z.string(),
	label: z.string().min(1).optional(),
	tags: z.array(z.string().min(1)),
	sort: NonNegativeIntegerSchema,
	merge: z.array(ItemMergeRuleSchema).optional(),
	producer: ProducerDefinitionSchema.optional(),
	stash: StashDefinitionSchema.optional(),
	craft: ItemCraftRecipeSchema.optional(),
});

type ItemDefinitionSchema = typeof ItemDefinitionSchema;
export namespace ItemDefinitionSchema {
	export type Type = z.infer<ItemDefinitionSchema>;
}
