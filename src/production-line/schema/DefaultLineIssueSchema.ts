import { z } from "zod";

import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "./DefaultLineIssueReasonEnumSchema";

import { IdSchema } from "~/game-config/schema/IdSchema";

/** One persisted default-line override no longer belongs to its exact live owner. */
export const DefaultLineIssueSchema = z
	.object({
		type: RuntimeCheckIssueEnumSchema.extract([
			"DefaultLine",
		]),
		ownerItemId: IdSchema,
		lineId: IdSchema.nullable(),
		reason: DefaultLineIssueReasonEnumSchema,
	})
	.strict()
	.meta({
		id: "DefaultLineIssueSchema",
		description: "One invalid save-backed default product-line override.",
	});

export type DefaultLineIssueSchema = typeof DefaultLineIssueSchema;

export namespace DefaultLineIssueSchema {
	export type Type = z.infer<DefaultLineIssueSchema>;
}
