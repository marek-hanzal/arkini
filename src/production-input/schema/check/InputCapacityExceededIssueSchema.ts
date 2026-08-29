import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";

/**
 * One material input buffer stores more quantity than its configured capacity.
 */
export const InputCapacityExceededIssueSchema = z
	.object({
		ownerItemId: IdSchema.describe("The runtime item that owns the overfilled input."),
		lineId: IdSchema.describe("The stable ID of the owner product line."),
		inputIndex: NonNegativeIntegerSchema.describe("The zero-based input position."),
		itemIds: z.array(IdSchema).min(1).describe("The buffered runtime items in this input."),
		storedQuantity: PositiveIntegerSchema.describe("The total buffered material quantity."),
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
		description: "One material input buffer exceeds its configured capacity.",
	});

export type InputCapacityExceededIssueSchema = typeof InputCapacityExceededIssueSchema;

export namespace InputCapacityExceededIssueSchema {
	export type Type = z.infer<InputCapacityExceededIssueSchema>;
}
