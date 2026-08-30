import { z } from "zod";

import { CheatStateSchema } from "~/game-runtime/schema/CheatStateSchema";
import { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import { JobQueueRequestSchema } from "~/production-job/schema/JobQueueRequestSchema";
import { JobSchema } from "~/production-job/schema/JobSchema";
import { DefaultLineByOwnerItemIdSchema } from "~/production-line/schema/DefaultLineByOwnerItemIdSchema";
import { RuntimeItemSchema } from "./RuntimeItemSchema";

/** Canonical loaded gameplay state for one exact persisted Game. */
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
			.describe("FIFO line-start requests not started yet."),
		defaultLineByOwnerItemId: DefaultLineByOwnerItemIdSchema.describe(
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
