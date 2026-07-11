import { z } from "zod";

import { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { BaseStateItemSchema } from "./BaseStateItemSchema";

/**
 * A persisted live item placed at one board position.
 */
export const StateBoardItemSchema = z
	.object({
		...BaseStateItemSchema.shape,
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
		id: "StateBoardItemSchema",
		description: "A persisted live item placed at one board position.",
	});

export type StateBoardItemSchema = typeof StateBoardItemSchema;

export namespace StateBoardItemSchema {
	export type Type = z.infer<StateBoardItemSchema>;
}
