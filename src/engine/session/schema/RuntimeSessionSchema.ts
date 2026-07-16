import { z } from "zod";

import { SpeedModeSchema } from "./SpeedModeSchema";

/** Engine-visible ephemeral state owned by one loaded runtime session. */
export const RuntimeSessionSchema = z
	.object({
		speedMode: SpeedModeSchema.describe(
			"How newly observed wall-clock time feeds the canonical fixed-step simulation.",
		),
	})
	.strict()
	.meta({
		id: "RuntimeSessionSchema",
		description: "Engine-visible ephemeral state owned by one loaded runtime session.",
	});

export type RuntimeSessionSchema = typeof RuntimeSessionSchema;

export namespace RuntimeSessionSchema {
	export type Type = z.infer<RuntimeSessionSchema>;
}
