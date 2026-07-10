import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { ItemSchema } from "~/v1/item/schema/ItemSchema";

/** Fields shared by every hydrated live item or item stack. */
export const BaseRuntimeItemSchema = z
	.object({
		/** Stable identity of this live item or stack. */
		id: IdSchema.describe("The stable identity of this live item or stack."),
		/** Canonical immutable item definition shared with the loaded game. */
		item: ItemSchema.describe(
			"The canonical immutable item definition shared with the loaded game.",
		),
		/** Number of canonical items represented by this live runtime entry. */
		quantity: PositiveIntegerSchema.describe(
			"The positive quantity represented by this live runtime entry.",
		),
	})
	.strict()
	.meta({
		id: "BaseRuntimeItemSchema",
		description: "The hydrated fields shared by every live item or item stack.",
	});

export type BaseRuntimeItemSchema = typeof BaseRuntimeItemSchema;

export namespace BaseRuntimeItemSchema {
	export type Type = z.infer<BaseRuntimeItemSchema>;
}
