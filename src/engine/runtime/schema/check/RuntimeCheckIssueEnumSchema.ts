import { z } from "zod";

/** The finite vocabulary of runtime invariant violations. */
export const RuntimeCheckIssueEnumSchema = z
	.enum({
		DuplicateJobId: "job:id:duplicate",
		JobOwnerMissing: "job:owner-missing",
		JobOwnerMultipleActive: "job:owner:multiple-active",
		JobOwnerNotOnGrid: "job:owner-not-on-grid",
		JobLineMissing: "job:line-missing",
		JobQueueExceeded: "job:queue-exceeded",
		JobTimeInvalid: "job:time-invalid",
		JobMaterialOrphan: "job:material-orphan",
		JobConsumedMaterialState: "job:consumed-material-state",
		DuplicateItemId: "item:id:duplicate",
		ItemMaxCount: "item:max-count",
		ItemCharges: "item:charges",
		ItemStackSize: "item:stack-size",
		ItemTemporaryDuration: "item:temporary-duration",
		InputOwnerMissing: "input:owner-missing",
		InputLineMissing: "input:line-missing",
		InputSlotInvalid: "input:slot-invalid",
		InputSelectorMismatch: "input:selector-mismatch",
		InputCapacityExceeded: "input:capacity-exceeded",
		DefaultLine: "line:default",
		LineInputClosed: "line:input-closed",
		LocationOccupied: "location:occupied",
		LocationOutOfBounds: "location:out-of-bounds",
		LocationScope: "location:scope",
	})
	.meta({
		id: "RuntimeCheckIssueEnumSchema",
		description: "The finite vocabulary of runtime invariant violations.",
	});

export type RuntimeCheckIssueEnumSchema = typeof RuntimeCheckIssueEnumSchema;

export namespace RuntimeCheckIssueEnumSchema {
	export type Type = z.infer<RuntimeCheckIssueEnumSchema>;
}
