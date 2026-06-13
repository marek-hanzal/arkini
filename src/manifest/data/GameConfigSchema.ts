import { z } from "zod";
import { AssetIdSchema } from "./AssetIdSchema";
import { ItemIdSchema } from "./ItemIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";
import { QuantitySchema } from "./QuantitySchema";
import { ResourceIdSchema } from "./ResourceIdSchema";
import { GameConfig } from "./GameConfig";

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
		playerInventory: z.object({
			slots: z.literal(GameConfig.game.playerInventory.slots),
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
			output: z.array(z.any()).min(1),
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
								z.object({
									type: z.literal("inventory.capacity.add"),
									inventory: z.enum([
										"board",
										"player",
									]),
									slots: PositiveIntegerSchema,
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
						inputCount: z.literal(2).optional(),
						secret: z.boolean().optional(),
					}),
				)
				.optional(),
			collect: z
				.object({
					inventory: z.literal("player"),
					itemId: ItemIdSchema.optional(),
					quantity: PositiveIntegerSchema.optional(),
				})
				.optional(),
			producer: z
				.object({
					trigger: z.literal("click"),
					placement: z.literal("board_then_inventory"),
					cooldownMs: PositiveIntegerSchema,
					outputTableId: z.string().startsWith("loot:").optional(),
					output: z
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
											z.union([
												z.object({
													itemId: ItemIdSchema,
													weight: PositiveIntegerSchema,
													quantity: QuantitySchema.optional(),
												}),
												z.object({
													itemId: z.null(),
													weight: PositiveIntegerSchema,
												}),
											]),
										)
										.min(1),
								}),
							]),
						)
						.min(1),
					doubleClickBehavior: z
						.enum([
							"exhaust",
						])
						.optional(),
					inputs: z
						.array(
							z.object({
								itemId: ItemIdSchema,
								quantity: PositiveIntegerSchema,
								capacity: PositiveIntegerSchema,
							}),
						)
						.optional(),
					mode: z
						.discriminatedUnion("type", [
							z.object({
								type: z.literal("infinite"),
							}),
							z.object({
								type: z.literal("finite"),
								charges: PositiveIntegerSchema,
								onDepleted: z.union([
									z.literal("remove"),
									z.object({
										replaceWithItemId: ItemIdSchema,
									}),
								]),
							}),
						])
						.optional(),
				})
				.optional(),
			craft: z
				.object({
					id: z.string().startsWith("craft:"),
					resultItemId: ItemIdSchema,
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
		playerInventory: z.array(
			z.object({
				itemId: ItemIdSchema,
				quantity: PositiveIntegerSchema,
			}),
		),
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
