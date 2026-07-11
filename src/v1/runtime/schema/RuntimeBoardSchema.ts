import { z } from "zod";

import { RuntimeBoardItemSchema } from "./RuntimeBoardItemSchema";

/**
 * Hydrated contents of the live runtime board.
 */
export const RuntimeBoardSchema = z
	.object({
		/**
		 * Live board items linked to their canonical item definitions.
		 */
		items: z
			.array(RuntimeBoardItemSchema)
			.describe("The hydrated live items placed on the board."),
	})
	.strict()
	.meta({
		id: "RuntimeBoardSchema",
		description: "The hydrated contents of the live runtime board.",
	});

export type RuntimeBoardSchema = typeof RuntimeBoardSchema;

export namespace RuntimeBoardSchema {
	export type Type = z.infer<RuntimeBoardSchema>;
}
