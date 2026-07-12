import { z } from "zod";

import { JobSchema } from "~/v1/job/schema/JobSchema";
import { StateItemSchema } from "./StateItemSchema";

/**
 * Serializable gameplay state stored without canonical configuration objects.
 *
 * State mirrors the runtime item model so hydration only resolves canonical
 * item definitions and never translates between competing storage shapes.
 */
export const StateSchema = z
	.object({
		/**
		 * Every persisted live item owned by the saved game.
		 */
		items: z.array(StateItemSchema).describe("Every persisted live item in the saved game."),
		/** Every persisted active product-line run. */
		jobs: z.array(JobSchema).describe("Every persisted active product-line run."),
	})
	.strict()
	.meta({
		id: "StateSchema",
		description:
			"Serializable gameplay state composed of persisted live items and active jobs.",
	});

export type StateSchema = typeof StateSchema;

export namespace StateSchema {
	export type Type = z.infer<StateSchema>;
}
