import { z } from "zod";

import { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { CategorySchema } from "~/v1/category/schema/CategorySchema";
import { MetaSchema } from "~/v1/meta/schema/MetaSchema";
import { StartSchema } from "~/v1/start/schema/StartSchema";
import { IdSchema } from "~/v1/common/schema/IdSchema";
import { VersionEnumSchema } from "./VersionEnumSchema";

/**
 * The root schema for a game's configuration.
 *
 * New game-wide configuration fields are added here as the schema is expanded.
 */
export const GameSchema = z
	.object({
		/**
		 * Optional JSON Schema reference used by configuration authoring tools.
		 */
		$schema: z
			.string()
			.min(1)
			.optional()
			.describe("The optional JSON Schema reference used by configuration authoring tools."),
		/**
		 * Core metadata and player-available layouts for this game.
		 */
		meta: MetaSchema.describe("Core metadata and player-available layouts for this game."),
		/**
		 * Board and inventory contents created for a new game.
		 */
		start: StartSchema.describe(
			"The initial board and inventory contents created for a new game.",
		),
		/**
		 * Canonical UI-facing categories keyed by their stable identifier.
		 */
		categories: z
			.record(IdSchema, CategorySchema)
			.describe("Canonical UI-facing categories keyed by a non-empty identifier."),
		/**
		 * Version of this game configuration's schema contract.
		 */
		version: VersionEnumSchema,
		/**
		 * Canonical game items keyed by their unique identifier.
		 */
		items: z
			.record(IdSchema, ItemSchema)
			.describe("Canonical game items keyed by a non-empty identifier."),
	})
	.strict()
	.superRefine((game, context) => {
		const occupiedBoardCells = new Set<string>();

		for (const [index, placement] of game.start.board.entries()) {
			if (!Object.hasOwn(game.items, placement.itemId)) {
				context.addIssue({
					code: "custom",
					path: [
						"start",
						"board",
						index,
						"itemId",
					],
					message: `Unknown initial board item: ${placement.itemId}.`,
				});
			}

			if (placement.x >= game.meta.board.width || placement.y >= game.meta.board.height) {
				context.addIssue({
					code: "custom",
					path: [
						"start",
						"board",
						index,
					],
					message: `Initial board coordinate (${placement.x}, ${placement.y}) is outside the configured board.`,
				});
			}

			const cell = `${placement.x}:${placement.y}`;

			if (occupiedBoardCells.has(cell)) {
				context.addIssue({
					code: "custom",
					path: [
						"start",
						"board",
						index,
					],
					message: `Initial board coordinate (${placement.x}, ${placement.y}) is occupied more than once.`,
				});
			}

			occupiedBoardCells.add(cell);
		}

		for (const [index, item] of game.start.inventory.entries()) {
			if (!Object.hasOwn(game.items, item.itemId)) {
				context.addIssue({
					code: "custom",
					path: [
						"start",
						"inventory",
						index,
						"itemId",
					],
					message: `Unknown initial inventory item: ${item.itemId}.`,
				});
			}
		}
	})
	.meta({
		id: "GameSchema",
		description: "The root configuration for a game.",
	});

export type GameSchema = typeof GameSchema;

export namespace GameSchema {
	export type Type = z.infer<GameSchema>;
}
