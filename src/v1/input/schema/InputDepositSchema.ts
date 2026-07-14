import { z } from "zod";

import { QuantitySchema } from "~/v1/quantity/schema/QuantitySchema";
import { QuerySchema } from "~/v1/query/schema/QuerySchema";
import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";

/**
 * Authored capacity requirement from a matching deposit on the board.
 *
 * Runtime capacity state is not implemented yet. The schema and validator preserve
 * the intended query and quantity while active input resolution rejects this kind;
 * deposit items are never delivered or moved into the line's
 * ordinary material buffer.
 */
export const InputDepositSchema = z
	.object({
		...BaseInputSchema.shape,
		/**
		 * Identifies this input as capacity from a matching board deposit.
		 */
		type: InputEnumSchema.extract([
			"deposit",
		]).describe("Identifies this input as capacity from a matching board deposit."),
		/**
		 * Query used to find a deposit that can satisfy this input.
		 */
		query: QuerySchema.describe(
			"The query used to find a deposit that can satisfy this input.",
		),
		/**
		 * Exact or bounded amount of deposit capacity spent every time the line completes.
		 */
		quantity: QuantitySchema.describe(
			"The exact or bounded amount of matching deposit capacity intended to be spent by completion.",
		),
	})
	.strict()
	.meta({
		id: "InputDepositSchema",
		description: "An authored capacity requirement from a matching board deposit.",
	});

export type InputDepositSchema = typeof InputDepositSchema;

export namespace InputDepositSchema {
	export type Type = z.infer<InputDepositSchema>;
}
