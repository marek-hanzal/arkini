import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";

/**
 * One material item currently buffered by a concrete owner line input.
 */
export const InputLocationSchema = z
	.object({
		/**
		 * Identifies this location as one line-owned input buffer.
		 */
		scope: z.literal("input"),
		/**
		 * Runtime identity of the item that owns the input buffer.
		 */
		ownerItemId: IdSchema.describe("The runtime item that owns this input buffer."),
		/**
		 * Stable ID of the owner product line.
		 */
		lineId: IdSchema.describe("The stable ID of the owner product line."),
		/**
		 * Zero-based position of this material input inside the product line.
		 */
		inputIndex: NonNegativeIntegerSchema.describe(
			"The zero-based position of this material input inside the product line.",
		),
	})
	.strict()
	.meta({
		id: "InputLocationSchema",
		description: "One material item buffered by a concrete owner line input.",
	});

export type InputLocationSchema = typeof InputLocationSchema;

export namespace InputLocationSchema {
	export type Type = z.infer<InputLocationSchema>;
}
