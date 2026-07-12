import { z } from "zod";

import { IdSchema } from "~/v1/common/schema/IdSchema";
import { LineRunResolutionSchema } from "~/v1/line/schema/run/LineRunResolutionSchema";
import { JobQueueResolutionSchema } from "./JobQueueResolutionSchema";

/** Current declarative state used to decide whether one line may start a job. */
export const LineStartResolutionSchema = z
	.object({
		ownerItemId: IdSchema.describe("The runtime item that owns this product line."),
		lineId: IdSchema.describe("The stable ID of the configured product line."),
		run: LineRunResolutionSchema.describe("The current product-line run state."),
		queue: JobQueueResolutionSchema.describe("The current job queue state of the line owner."),
		ready: z
			.boolean()
			.describe("Whether the line has a run plan and its owner has queue capacity."),
	})
	.strict()
	.meta({
		id: "LineStartResolutionSchema",
		description:
			"The current declarative state used to decide whether one line may start a job.",
	});

export type LineStartResolutionSchema = typeof LineStartResolutionSchema;

export namespace LineStartResolutionSchema {
	export type Type = z.infer<LineStartResolutionSchema>;
}
