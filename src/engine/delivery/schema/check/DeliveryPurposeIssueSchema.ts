import { z } from "zod";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { DeliveryPurposeSchema } from "~/engine/delivery/schema/DeliveryPurposeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { DeliveryPurposeIssueReasonEnumSchema } from "./DeliveryPurposeIssueReasonEnumSchema";

export const DeliveryPurposeIssueSchema = z
	.object({
		itemId: IdSchema.optional(),
		purpose: DeliveryPurposeSchema,
		reason: DeliveryPurposeIssueReasonEnumSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"DeliveryPurpose",
		]),
	})
	.strict()
	.meta({
		id: "DeliveryPurposeIssueSchema",
		description: "One invalid durable delivery or aggregate start purpose.",
	});

export type DeliveryPurposeIssueSchema = typeof DeliveryPurposeIssueSchema;

export namespace DeliveryPurposeIssueSchema {
	export type Type = z.infer<DeliveryPurposeIssueSchema>;
}
