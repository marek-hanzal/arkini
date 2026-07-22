import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { ItemTemporaryDurationIssueReasonEnumSchema } from "./ItemTemporaryDurationIssueReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { LocationSchema } from "~/engine/location/schema/LocationSchema";

/** One live item violates the canonical temporary-lifetime contract. */
export const ItemTemporaryDurationIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.ItemTemporaryDuration,
		]),
		itemId: IdSchema,
		durationMs: TimeSchema.optional(),
		remainingDurationMs: TimeSchema.optional(),
		location: LocationSchema,
		reason: ItemTemporaryDurationIssueReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "ItemTemporaryDurationIssueSchema",
		description: "One invalid live temporary-item duration diagnostic.",
	});

export type ItemTemporaryDurationIssueSchema = typeof ItemTemporaryDurationIssueSchema;

export namespace ItemTemporaryDurationIssueSchema {
	export type Type = z.infer<ItemTemporaryDurationIssueSchema>;
}
