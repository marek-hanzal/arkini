import { z } from "zod";

import { GameSchema } from "~/v1/schema/GameSchema";
import { RuntimeBoardSchema } from "./RuntimeBoardSchema";
import { RuntimeInventorySchema } from "./RuntimeInventorySchema";

/**
 * Core hydrated gameplay runtime.
 *
 * Runtime item definitions are canonical references from `game.items` created
 * by hydration. Re-parsing an already hydrated runtime is not part of the
 * normal lifecycle because schema parsing cannot preserve object identity.
 */
export const RuntimeSchema = z
	.object({
		/**
		 * Loaded immutable game configuration owning every canonical item definition.
		 */
		game: GameSchema.describe(
			"The loaded game configuration owning every canonical item definition.",
		),
		/**
		 * Hydrated live board contents.
		 */
		board: RuntimeBoardSchema.describe("The hydrated live board contents."),
		/**
		 * Hydrated live inventory contents.
		 */
		inventory: RuntimeInventorySchema.describe("The hydrated live inventory contents."),
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The core hydrated gameplay runtime and its loaded game configuration.",
	});

export type RuntimeSchema = typeof RuntimeSchema;

export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
