import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** One save-backed player selection enabling autonomous cycles for an exact live line. */
export const AutonomousLineSchema = z
	.object({
		lineId: IdSchema,
		ownerItemId: IdSchema,
	})
	.strict()
	.meta({
		id: "AutonomousLineSchema",
		description: "One enabled autonomous line bound to a live owner identity.",
	});

export type AutonomousLineSchema = typeof AutonomousLineSchema;

export namespace AutonomousLineSchema {
	export type Type = z.infer<AutonomousLineSchema>;
}
