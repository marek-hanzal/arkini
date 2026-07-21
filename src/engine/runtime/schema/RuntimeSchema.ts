import { z } from "zod";

import { CheatStateSchema } from "~/engine/cheat/schema/CheatStateSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { JobQueueRequestSchema } from "~/engine/job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/engine/job/schema/JobSchema";
import { DefaultLineByOwnerItemIdSchema } from "~/engine/line/schema/DefaultLineByOwnerItemIdSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** Canonical loaded runtime composed of ephemeral session state and live gameplay state. */
export const RuntimeSchema = z
	.object({
		cheats: CheatStateSchema.describe(
			"Persisted cheat switches owned by this exact loaded Game.",
		),
		currentSpace: NonNegativeIntegerSchema.describe(
			"The persistent board space currently presented to the player.",
		),
		items: z
			.array(RuntimeItemSchema)
			.describe("Every hydrated live item currently owned by the runtime."),
		jobs: z
			.array(JobSchema)
			.describe("Every active product-line run currently owned by the runtime."),
		jobQueue: z
			.array(JobQueueRequestSchema)
			.optional()
			.describe("FIFO line-start requests not started yet."),
		defaultLineByOwnerItemId: DefaultLineByOwnerItemIdSchema.optional().describe(
			"Save-backed default product line selected for exact live owner identities.",
		),
	})
	.strict()
	.meta({
		id: "RuntimeSchema",
		description: "The canonical loaded runtime state value.",
	});
export type RuntimeSchema = typeof RuntimeSchema;
export namespace RuntimeSchema {
	export type Type = z.infer<RuntimeSchema>;
}
