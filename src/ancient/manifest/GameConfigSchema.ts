import { z } from "zod";
import { ActivationInputSchema } from "./ActivationInputSchema";
import { ActivationRequirementSchema } from "./ActivationRequirementSchema";
import { ActivationOutputSchema } from "./ActivationOutputSchema";
import { GameAssetIdSchema } from "./GameAssetIdSchema";
import { GameConfig } from "./GameConfig";
import { GameCraftRecipeIdSchema } from "./GameCraftRecipeIdSchema";
import { GameItemIdSchema } from "./GameItemIdSchema";
import { GameLootTableIdSchema } from "./GameLootTableIdSchema";
import { GameMergeDefinitionIdSchema } from "./GameMergeDefinitionIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";
import { GameResourceIdSchema } from "./GameResourceIdSchema";
import { GameUpgradeIdSchema } from "./GameUpgradeIdSchema";

export const GameConfigSchema = z.object({
	game: z.object({
		id: z.literal(GameConfig.game.id),
		title: z.literal(GameConfig.game.title),
		board: z.object({
			width: z.literal(GameConfig.game.board.width),
			height: z.literal(GameConfig.game.board.height),
		}),
		inventory: z.object({
			slots: z.literal(GameConfig.game.inventory.slots),
		}),
	}),
	assets: z.array(
		z.object({
			id: GameAssetIdSchema,
			kind: z.enum([
				"item",
				"ui",
			]),
			label: z.string().min(1),
			src: z.string().min(1),
			sort: NonNegativeIntegerSchema,
		}),
	),
	resources: z.array(
		z.object({
			id: GameResourceIdSchema,
			code: z.string().min(1),
			name: z.string().min(1),
			description: z.string(),
			symbol: z.string().min(1),
			sort: NonNegativeIntegerSchema,
		}),
	),
	lootTables: z.array(
		z.object({
			id: GameLootTableIdSchema,
			name: z.string().min(1),
			output: ActivationOutputSchema,
		}),
	),
	upgrades: z.array(
		z.object({
			id: GameUpgradeIdSchema,
			code: z.string().min(1),
			name: z.string().min(1),
			description: z.string(),
			sort: NonNegativeIntegerSchema,
			tiers: z
				.array(
					z.object({
						cost: z.array(
							z.object({
								itemId: GameItemIdSchema,
								quantity: PositiveIntegerSchema,
							}),
						),
						durationMs: NonNegativeIntegerSchema,
						effects: z.array(
							z.discriminatedUnion("type", [
								z.object({
									type: z.literal("producer.cooldown.add"),
									itemId: GameItemIdSchema,
									ms: z.number().int(),
								}),
								z.object({
									type: z.literal("producer.outputTable.set"),
									itemId: GameItemIdSchema,
									tableId: GameLootTableIdSchema,
								}),
							]),
						),
					}),
				)
				.min(1),
		}),
	),
	items: z.array(
		z.object({
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
			merge: z
				.array(
					z.object({
						id: GameMergeDefinitionIdSchema,
						withItemId: GameItemIdSchema,
						resultItemId: GameItemIdSchema,
						consumeSource: z.boolean().optional(),
						inputCount: z.literal(2).optional(),
						secret: z.boolean().optional(),
					}),
				)
				.optional(),
			producer: z
				.object({
					type: z.literal("producer"),
					trigger: z.literal("click"),
					placement: z.literal("board_then_inventory"),
					cooldownMs: PositiveIntegerSchema,
					outputTableId: GameLootTableIdSchema,
					inputs: ActivationInputSchema,
					requirements: ActivationRequirementSchema,
				})
				.optional(),
			stash: z
				.object({
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
				})
				.optional(),
			craft: z
				.object({
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
				})
				.optional(),
		}),
	),
	startingState: z.object({
		resources: z.array(
			z.object({
				resourceId: GameResourceIdSchema,
				quantity: NonNegativeIntegerSchema,
			}),
		),
		inventory: z.array(
			z.object({
				itemId: GameItemIdSchema,
				quantity: PositiveIntegerSchema,
			}),
		),
		board: z.array(
			z.object({
				itemId: GameItemIdSchema,
				x: NonNegativeIntegerSchema,
				y: NonNegativeIntegerSchema,
			}),
		),
	}),
});

type GameConfigSchema = typeof GameConfigSchema;
export namespace GameConfigSchema {
	export type Type = z.infer<GameConfigSchema>;
}
