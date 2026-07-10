import { z } from "zod";

import { StateBoardItemSchema } from "./StateBoardItemSchema";

/** Persisted contents of the runtime board. */
export const StateBoardSchema = z
	.object({
		/** Live board items with their identity, canonical ID, quantity, and position. */
		items: z
			.array(StateBoardItemSchema)
			.describe("The persisted live items placed on the board."),
	})
	.strict()
	.meta({
		id: "StateBoardSchema",
		description: "The persisted contents of the runtime board.",
	});

export type StateBoardSchema = typeof StateBoardSchema;

export namespace StateBoardSchema {
	export type Type = z.infer<StateBoardSchema>;
}
