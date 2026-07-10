import { z } from "zod";

import { InputDepositSchema } from "./InputDepositSchema";
import { InputMaterialSchema } from "./InputMaterialSchema";

/**
 * A discriminated resource requirement for one product line.
 *
 * Material inputs are directly delivered items. Deposit inputs instead spend
 * capacity from a matching board source without moving that source into a line.
 */
export const InputSchema = z
	.discriminatedUnion("type", [
		InputMaterialSchema,
		InputDepositSchema,
	])
	.meta({
		id: "InputSchema",
		description: "A material-item or board-deposit resource requirement for a product line.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
