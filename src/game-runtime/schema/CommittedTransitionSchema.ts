import { z } from "zod";

import { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/**
 * The single publication unit owned by the runtime store.
 *
 * `previousRuntime`, `runtime`, and `events` always belong to the same serialized
 * commit. Events are transient facts for that boundary, while `sequence` lets
 * subscribers preserve order even when multiple commands race to enter the store.
 */
export const CommittedTransitionSchema = z
	.object({
		sequence: z.number().int().nonnegative(),
		previousRuntime: RuntimeSchema.nullable(),
		runtime: RuntimeSchema,
		events: z.array(GameEventSchema),
	})
	.strict()
	.meta({
		id: "CommittedTransitionSchema",
		description:
			"One sequenced atomically committed gameplay runtime snapshot with its bounded previous runtime and transient metadata describing that exact transition.",
	});

export type CommittedTransitionSchema = typeof CommittedTransitionSchema;

export namespace CommittedTransitionSchema {
	export type Type = z.infer<CommittedTransitionSchema>;
}
