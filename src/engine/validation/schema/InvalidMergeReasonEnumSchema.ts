import { z } from "zod";

/** Why one authored merge rule cannot participate in the board runtime topology. */
export const InvalidMergeReasonEnumSchema = z
	.enum({
		TargetUnavailable: "target-unavailable",
		ResultUnavailable: "result-unavailable",
		SelfTargetUnavailable: "self-target-unavailable",
	})
	.meta({
		id: "InvalidMergeReasonEnumSchema",
		description: "Why one authored merge rule cannot participate in the board runtime topology.",
	});

export type InvalidMergeReasonEnumSchema = typeof InvalidMergeReasonEnumSchema;

export namespace InvalidMergeReasonEnumSchema {
	export type Type = z.infer<InvalidMergeReasonEnumSchema>;
}
