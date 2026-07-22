import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "./DefaultLineIssueReasonEnumSchema";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** One persisted default-line selection no longer belongs to its exact live owner. */
export const DefaultLineIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			RuntimeCheckIssueEnumSchema.enum.DefaultLine,
		]),
		ownerItemId: IdSchema,
		lineId: IdSchema,
		reason: DefaultLineIssueReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "DefaultLineIssueSchema",
		description: "One invalid save-backed default product-line selection.",
	});

export type DefaultLineIssueSchema = typeof DefaultLineIssueSchema;

export namespace DefaultLineIssueSchema {
	export type Type = z.infer<DefaultLineIssueSchema>;
}
