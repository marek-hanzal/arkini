import { z } from "zod";

import { InputDepositSchema } from "./InputDepositSchema";
import { InputMaterialSchema } from "./InputMaterialSchema";
import { InputSimpleSchema } from "./InputSimpleSchema";

/**
 * A discriminated resource requirement for one product line.
 *
 * Simple inputs carry no resource operation. Material inputs are directly
 * delivered items. Deposit inputs instead spend capacity from a matching board
 * source without moving that source into a line.
 */
export const InputSchema = z
	.discriminatedUnion("type", [
		InputSimpleSchema,
		InputMaterialSchema,
		InputDepositSchema,
	])
	.meta({
		id: "InputSchema",
		description:
			"A simple, material-item, or board-deposit input requirement for a product line.",
	});

export type InputSchema = typeof InputSchema;

export namespace InputSchema {
	export type Type = z.infer<InputSchema>;
}
