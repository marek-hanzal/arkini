import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";

import { BoardItemSchema } from "./BoardItemSchema";

/** Defines the complete board state for a new game. */
export const StartSchema = z
	.object({
		currentSpace: NonNegativeIntegerSchema.describe(
			"The board space presented when a new game starts.",
		),
		/**
		 * Items placed at explicit initial board coordinates.
		 */
		board: z
			.array(BoardItemSchema)
			.default([])
			.describe("The items placed at explicit coordinates when a new game starts."),
	})
	.strict()
	.meta({
		id: "StartSchema",
		description: "The initial board placements for a new game.",
	});

export type StartSchema = typeof StartSchema;

export namespace StartSchema {
	export type Type = z.infer<StartSchema>;
}
