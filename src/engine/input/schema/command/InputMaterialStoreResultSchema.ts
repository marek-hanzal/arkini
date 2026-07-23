import { z } from "zod";

import { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";

/**
 * Concrete runtime changes produced by storing one delivered material item.
 */
export const InputMaterialStoreResultSchema = z
	.object({
		/**
		 * Exact visible source state used by the accepted mutation.
		 */
		sourceBefore: GridRuntimeItemSchema.describe(
			"The exact visible source state used by the accepted mutation.",
		),
		/**
		 * Exact final grid owner state committed by the mutation, including isolation.
		 */
		ownerItem: GridRuntimeItemSchema.describe(
			"The exact final grid owner state committed by the mutation, including isolation.",
		),
		/**
		 * Material item now owned by the target input slot.
		 */
		storedItem: InputRuntimeItemSchema.describe(
			"The material item now owned by the target input slot.",
		),
		/**
		 * Remaining source stack after a partial store operation.
		 */
		sourceItem: GridRuntimeItemSchema.optional().describe(
			"The remaining source stack after a partial store operation.",
		),
	})
	.strict()
	.meta({
		id: "InputMaterialStoreResultSchema",
		description: "The concrete runtime changes produced by one material store operation.",
	});

export type InputMaterialStoreResultSchema = typeof InputMaterialStoreResultSchema;

export namespace InputMaterialStoreResultSchema {
	export type Type = z.infer<InputMaterialStoreResultSchema>;
}
