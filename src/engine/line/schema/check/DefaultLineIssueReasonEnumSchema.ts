import { z } from "zod";

/** Why one persisted default-line selection is invalid. */
export const DefaultLineIssueReasonEnumSchema = z
	.enum({
		OwnerMissing: "owner-missing",
		OwnerUnsupported: "owner-unsupported",
		LineMissing: "line-missing",
	})
	.meta({
		id: "DefaultLineIssueReasonEnumSchema",
		description: "Why one persisted default-line selection is invalid.",
	});

export type DefaultLineIssueReasonEnumSchema = typeof DefaultLineIssueReasonEnumSchema;

export namespace DefaultLineIssueReasonEnumSchema {
	export type Type = z.infer<DefaultLineIssueReasonEnumSchema>;
}
