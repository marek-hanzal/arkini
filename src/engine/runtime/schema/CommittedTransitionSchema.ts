import { z } from "zod";

import { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export const CommittedTransitionSchema = z
	.object({
		runtime: RuntimeSchema,
		events: z.array(GameEventSchema),
	})
	.strict()
	.meta({
		id: "CommittedTransitionSchema",
		description:
			"One atomically committed gameplay runtime snapshot with transient metadata describing that exact transition.",
	});

export type CommittedTransitionSchema = typeof CommittedTransitionSchema;

export namespace CommittedTransitionSchema {
	export type Type = z.infer<CommittedTransitionSchema>;
}
