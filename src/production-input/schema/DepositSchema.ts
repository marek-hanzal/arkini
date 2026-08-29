import { z } from "zod";

import { BoardSchema } from "~/engine/query/schema/BoardSchema";

import { BaseSchema } from "./BaseSchema";
import { TypeSchema } from "./TypeSchema";

/**
 * An external charged-item target selected from the board.
 *
 * The target is never delivered into an input buffer. Its charge cost is authored
 * through the shared `charges` field and paid atomically when the enclosing action commits.
 */
export const DepositSchema = z
	.object({
		...BaseSchema.shape,
		/**
		 * Identifies this input as one external charged-item target on the board.
		 */
		type: TypeSchema.extract([
			"Deposit",
		]).describe("Identifies this input as one external charged-item target on the board."),
		/**
		 * Board query used to select one charged target for this input.
		 */
		query: BoardSchema.describe(
			"The board query used to select one charged target for this input.",
		),
	})
	.strict()
	.meta({
		id: "input.DepositSchema",
		description: "A board query that resolves one external charged-item target.",
	});

export type DepositSchema = typeof DepositSchema;

export namespace DepositSchema {
	export type Type = z.infer<DepositSchema>;
}
