import { z } from "zod";

import { RuntimeBoardSchema } from "./RuntimeBoardSchema";
import { RuntimeInventorySchema } from "./RuntimeInventorySchema";

/**
 * Core mutable gameplay runtime.
 *
 * Runtime item definitions are canonical references from `GameConfigFx`
 * created by hydration. Re-parsing an already hydrated runtime is not part of
 * the normal lifecycle because schema parsing cannot preserve object identity.
 */
export const RuntimeSchema = z
	.object({
		/**
		 * Hydrated live board items keyed by their grid cell.
		 */
		board: RuntimeBoardSchema.describe("The hydrated live board grid."),
		/**
		 * Hydrated live inventory items keyed by their grid cell.
		 */
		inventory: RuntimeInventorySchema.describe("The hydrated live inventory grid."),
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The core mutable hydrated gameplay runtime.",
	});

export type RuntimeSchema = typeof RuntimeSchema;

export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
