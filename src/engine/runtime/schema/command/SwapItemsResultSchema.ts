import { z } from "zod";

import { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";

/**
 * Two runtime items after their locations were atomically exchanged.
 */
export const SwapItemsResultSchema = z
	.object({
		first: RuntimeItemSchema.describe("The first item after the swap."),
		second: RuntimeItemSchema.describe("The second item after the swap."),
		relocations: z
			.array(
				z.object({
					item: RuntimeItemSchema,
					previousLocation: GridLocationSchema,
				}),
			)
			.describe(
				"Every displaced identity after deterministic relocation, with the explicit target first.",
			),
	})
	.strict()
	.meta({
		id: "SwapItemsResultSchema",
		description: "Two runtime items after an atomic location swap.",
	});

export type SwapItemsResultSchema = typeof SwapItemsResultSchema;

export namespace SwapItemsResultSchema {
	export type Type = z.infer<SwapItemsResultSchema>;
}
