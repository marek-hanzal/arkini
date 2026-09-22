import { z } from "zod";

/** Why one authored merge rule cannot participate in the board runtime topology. */
export const InvalidMergeReasonEnumSchema = z
	.enum({
		SourceUnitsDisabled: "source-units-disabled",
		TargetUnitsDisabled: "target-units-disabled",
	})
	.meta({
		id: "InvalidMergeReasonEnumSchema",
		description:
			"Why one authored merge rule cannot participate in the board runtime topology.",
	});

export type InvalidMergeReasonEnumSchema = typeof InvalidMergeReasonEnumSchema;

export namespace InvalidMergeReasonEnumSchema {
	export type Type = z.infer<InvalidMergeReasonEnumSchema>;
}
