import { z } from "zod";
import { CheatStateSchema } from "~/engine/cheat/schema/CheatStateSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { JobQueueRequestSchema } from "~/engine/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/engine/job/schema/JobSchema";
import { DefaultLineByOwnerItemIdSchema } from "~/engine/line/schema/DefaultLineByOwnerItemIdSchema";
import { StateItemSchema } from "./StateItemSchema";
export const StateSchema = z
	.object({
		cheats: CheatStateSchema.describe("Persisted cheat switches for this exact Game save."),
		currentSpace: NonNegativeIntegerSchema.describe(
			"The persistent board space currently presented to the player.",
		),
		items: z.array(StateItemSchema),
		jobs: z.array(JobSchema),
		jobQueue: z.array(JobQueueRequestSchema).optional(),
		defaultLineByOwnerItemId: DefaultLineByOwnerItemIdSchema.optional(),
	})
	.strict()
	.meta({
		id: "StateSchema",
		description: "Serializable gameplay state.",
	});
export type StateSchema = typeof StateSchema;
export namespace StateSchema {
	export type Type = z.infer<StateSchema>;
}
