import { z } from "zod";
import { AssetIdSchema } from "./AssetIdSchema";
import { ItemIdSchema } from "./ItemIdSchema";
import { NonNegativeIntegerSchema } from "./NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "./PositiveIntegerSchema";
import { QuantitySchema } from "./QuantitySchema";
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
			producer: z
				.object({
					trigger: z.literal("click"),
					placement: z.literal("board_then_inventory"),
					cooldownMs: PositiveIntegerSchema,
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
			build: z
				.object({
					id: z.string().startsWith("build:"),
					resultItemId: ItemIdSchema,
					costs: z.array(
						z.object({
							itemId: ItemIdSchema,
							quantity: PositiveIntegerSchema,
						}),
					),
				})
				.optional(),
		}),
	),
	startingState: z.object({
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
