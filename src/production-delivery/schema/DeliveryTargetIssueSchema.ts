import { z } from "zod";

import { IdSchema } from "~/game-value/schema/IdSchema";
import { LineInputDeliveryTargetSchema } from "~/production-delivery/schema/LineInputDeliveryTargetSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { DeliveryTargetIssueReasonEnumSchema } from "./DeliveryTargetIssueReasonEnumSchema";

/** One or more outbound deliveries violate their canonical target contract. */
export const DeliveryTargetIssueSchema = z
	.object({
		itemIds: z
			.array(IdSchema)
			.min(1)
			.describe("The outbound deliveries participating in this invariant violation."),
		reason: DeliveryTargetIssueReasonEnumSchema,
		target: LineInputDeliveryTargetSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"DeliveryTarget",
		]),
	})
	.strict()
	.meta({
		id: "DeliveryTargetIssueSchema",
		description: "One invalid canonical outbound delivery target.",
	});

export type DeliveryTargetIssueSchema = typeof DeliveryTargetIssueSchema;

export namespace DeliveryTargetIssueSchema {
	export type Type = z.infer<DeliveryTargetIssueSchema>;
}
