import { z } from "zod";

import { QueryBoardSchema } from "~/v1/query/schema/QueryBoardSchema";
import { BaseInputSchema } from "./BaseInputSchema";
import { InputEnumSchema } from "./InputEnumSchema";

/**
 * An external charged-item target selected from the board.
 *
 * The target is never delivered into an input buffer. Its charge cost is authored
 * through the shared input `charges` field and paid atomically when the line starts.
 */
export const InputDepositSchema = z
	.object({
		...BaseInputSchema.shape,
		/**
		 * Identifies this input as one external charged-item target on the board.
		 */
		type: InputEnumSchema.extract([
			"deposit",
		]).describe("Identifies this input as one external charged-item target on the board."),
		/**
		 * Board query used to select one charged target for this input.
		 */
		query: QueryBoardSchema.describe(
			"The board query used to select one charged target for this input.",
		),
	})
	.strict()
	.meta({
		id: "InputDepositSchema",
		description: "A board query that resolves one external charged-item target.",
	});

export type InputDepositSchema = typeof InputDepositSchema;

export namespace InputDepositSchema {
	export type Type = z.infer<InputDepositSchema>;
}
