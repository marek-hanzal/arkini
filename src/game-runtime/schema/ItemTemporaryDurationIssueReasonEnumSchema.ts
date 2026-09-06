import { z } from "zod";

/** Why one live item's temporary-duration state is invalid. */
export const ItemTemporaryDurationIssueReasonEnumSchema = z
	.enum({
		MissingState: "missing-state",
		UnexpectedState: "unexpected-state",
		ExceedsDuration: "exceeds-duration",
		UnsupportedLocation: "unsupported-location",
	})
	.meta({
		id: "ItemTemporaryDurationIssueReasonEnumSchema",
		description: "Why one live item's temporary-duration state is invalid.",
	});

export type ItemTemporaryDurationIssueReasonEnumSchema =
	typeof ItemTemporaryDurationIssueReasonEnumSchema;

export namespace ItemTemporaryDurationIssueReasonEnumSchema {
	export type Type = z.infer<ItemTemporaryDurationIssueReasonEnumSchema>;
}
