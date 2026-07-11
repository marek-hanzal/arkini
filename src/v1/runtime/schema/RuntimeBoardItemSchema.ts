import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { BaseRuntimeItemSchema } from "./BaseRuntimeItemSchema";

/**
 * A hydrated live item placed at one board position.
 */
export const RuntimeBoardItemSchema = z
	.object({
		...BaseRuntimeItemSchema.shape,
		/**
		 * Zero-based horizontal board coordinate.
		 */
		x: NonNegativeIntegerSchema.describe("The zero-based horizontal board coordinate."),
		/**
		 * Zero-based vertical board coordinate.
		 */
		y: NonNegativeIntegerSchema.describe("The zero-based vertical board coordinate."),
	})
	.strict()
	.meta({
		id: "RuntimeBoardItemSchema",
		description: "A hydrated live item placed at one board position.",
	});

export type RuntimeBoardItemSchema = typeof RuntimeBoardItemSchema;

export namespace RuntimeBoardItemSchema {
	export type Type = z.infer<RuntimeBoardItemSchema>;
}
