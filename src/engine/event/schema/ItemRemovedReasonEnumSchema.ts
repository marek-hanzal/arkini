import { z } from "zod";

/** The concrete autonomous operation that removed one visible runtime item. */
export const ItemRemovedReasonEnumSchema = z
	.enum({
		Consumed: "consumed",
		Depleted: "depleted",
		Expired: "expired",
		Lifecycle: "lifecycle",
	})
	.meta({
		id: "ItemRemovedReasonEnumSchema",
		description: "The concrete autonomous operation that removed one visible runtime item.",
	});

export type ItemRemovedReasonEnumSchema = typeof ItemRemovedReasonEnumSchema;

export namespace ItemRemovedReasonEnumSchema {
	export type Type = z.infer<ItemRemovedReasonEnumSchema>;
}
