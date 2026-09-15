import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";

/**
 * One material input stores more quantity than its configured maximum.
 */
export const InputCapacityExceededIssueSchema = z
	.object({
		ownerItemId: IdSchema.describe("The runtime item that owns the overfilled input."),
		lineId: IdSchema.describe("The stable ID of the owner product line."),
		inputIndex: NonNegativeIntegerSchema.describe("The zero-based input position."),
		itemIds: z.array(IdSchema).min(1).describe("The runtime items stored in this input."),
		storedQuantity: PositiveIntegerSchema.describe("The total stored material quantity."),
		maxStoredQuantity: PositiveIntegerSchema.describe(
			"The largest quantity allowed by this input.",
		),
		type: RuntimeCheckIssueEnumSchema.extract([
			"InputCapacityExceeded",
		]),
	})
	.strict()
	.meta({
		id: "InputCapacityExceededIssueSchema",
		description: "One material input exceeds its configured maximum.",
	});

export type InputCapacityExceededIssueSchema = typeof InputCapacityExceededIssueSchema;

export namespace InputCapacityExceededIssueSchema {
	export type Type = z.infer<InputCapacityExceededIssueSchema>;
}
