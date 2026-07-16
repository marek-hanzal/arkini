import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

export const CheatInventoryConsumedGameEventSchema = z
	.object({
		type: z.literal("cheat-inventory:consumed"),
		sourceItemId: IdSchema,
		sourceCanonicalItemId: IdSchema,
		targetItemId: IdSchema,
		targetCanonicalItemId: IdSchema,
		quantity: PositiveIntegerSchema,
	})
	.strict()
	.meta({
		id: "CheatInventoryConsumedGameEventSchema",
		description:
			"Transient fact that one complete board source identity was consumed by a cheat-inventory sink.",
	});

export type CheatInventoryConsumedGameEventSchema = typeof CheatInventoryConsumedGameEventSchema;

export namespace CheatInventoryConsumedGameEventSchema {
	export type Type = z.infer<CheatInventoryConsumedGameEventSchema>;
}
