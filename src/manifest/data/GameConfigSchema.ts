import { z } from "zod";
import { AssetIdSchema } from "./AssetIdSchema";
import { GameConfig } from "./GameConfig";
import { ItemIdSchema } from "./ItemIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";
import { QuantitySchema } from "./QuantitySchema";
import { ResourceIdSchema } from "./ResourceIdSchema";

const ActivationOutputSchema = z
	.array(
		z.discriminatedUnion("type", [
			z.object({
				type: z.literal("guaranteed"),
				itemId: ItemIdSchema,
				quantity: QuantitySchema.optional(),
			}),
			z.object({
				type: z.literal("chance"),
				itemId: ItemIdSchema,
				probability: z.number().min(0).max(1),
				quantity: QuantitySchema.optional(),
			}),
			z.object({
				type: z.literal("weighted"),
				rolls: QuantitySchema.optional(),
				entries: z
					.array(
						z.object({
							itemId: ItemIdSchema,
							weight: PositiveIntegerSchema,
							quantity: QuantitySchema.optional(),
						}),
					)
					.min(1),
			}),
		]),
	)
	.min(1);

const ActivationInputSchema = z
	.array(
		z.object({
			itemId: ItemIdSchema,
			quantity: PositiveIntegerSchema,
			capacity: PositiveIntegerSchema,
		}),
	)
	.optional();

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
			id: AssetIdSchema,
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
			id: ResourceIdSchema,
			code: z.string().min(1),
			name: z.string().min(1),
			description: z.string(),
			symbol: z.string().min(1),
			sort: NonNegativeIntegerSchema,
		}),
	),
	lootTables: z.array(
		z.object({
			id: z.string().startsWith("loot:"),
			name: z.string().min(1),
			output: ActivationOutputSchema,
		}),
	),
	upgrades: z.array(
		z.object({
			id: z.string().startsWith("upgrade:"),
			code: z.string().min(1),
			name: z.string().min(1),
			description: z.string(),
			sort: NonNegativeIntegerSchema,
			tiers: z
				.array(
					z.object({
						cost: z.array(
							z.object({
								itemId: ItemIdSchema,
								quantity: PositiveIntegerSchema,
							}),
						),
						durationMs: NonNegativeIntegerSchema,
						effects: z.array(
							z.discriminatedUnion("type", [
								z.object({
									type: z.literal("producer.cooldown.add"),
									itemId: ItemIdSchema,
									ms: z.number().int(),
								}),
								z.object({
									type: z.literal("producer.outputTable.set"),
									itemId: ItemIdSchema,
									tableId: z.string().startsWith("loot:"),
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
			id: ItemIdSchema,
			assetId: AssetIdSchema,
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
						id: z.string().startsWith("merge:"),
						withItemId: ItemIdSchema,
						resultItemId: ItemIdSchema,
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
					outputTableId: z.string().startsWith("loot:"),
					inputs: ActivationInputSchema,
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
							replaceWithItemId: ItemIdSchema,
						}),
					]),
					outputTableId: z.string().startsWith("loot:"),
					inputs: ActivationInputSchema,
				})
				.optional(),
			craft: z
				.object({
					id: z.string().startsWith("craft:"),
					resultItemId: ItemIdSchema,
					durationMs: NonNegativeIntegerSchema,
					inputs: z
						.array(
							z.object({
								itemId: ItemIdSchema,
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
				resourceId: ResourceIdSchema,
				quantity: NonNegativeIntegerSchema,
			}),
		),
		inventory: z.array(
			z.object({
				itemId: ItemIdSchema,
				quantity: PositiveIntegerSchema,
			}),
		),
		board: z.array(
			z.object({
				itemId: ItemIdSchema,
				x: NonNegativeIntegerSchema,
				y: NonNegativeIntegerSchema,
			}),
		),
	}),
});
