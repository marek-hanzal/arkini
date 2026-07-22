import { z } from "zod";

import { BaseItemSchema } from "./BaseItemSchema";
import { ItemEnumSchema } from "./ItemEnumSchema";

/** An item classified as a board resource deposit. */
export const DepositItemSchema = z
	.object({
		...BaseItemSchema.shape,
		type: ItemEnumSchema.extract([
			ItemEnumSchema.enum.Deposit,
		]),
	})
	.strict()
	.meta({
		id: "DepositItemSchema",
		description: "An item classified as a board resource deposit.",
	});

export type DepositItemSchema = typeof DepositItemSchema;

export namespace DepositItemSchema {
	export type Type = z.infer<DepositItemSchema>;
}
