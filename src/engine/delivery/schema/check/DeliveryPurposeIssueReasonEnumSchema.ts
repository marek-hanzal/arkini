import { z } from "zod";

export const DeliveryPurposeIssueReasonEnumSchema = z.enum({
	AutonomousDisabled: "autonomous-disabled",
	Duplicate: "duplicate",
	LineMissing: "line-missing",
	OwnerMissing: "owner-missing",
	OwnerNotOnBoard: "owner-not-on-board",
	TargetMismatch: "target-mismatch",
});

export type DeliveryPurposeIssueReasonEnumSchema = typeof DeliveryPurposeIssueReasonEnumSchema;

export namespace DeliveryPurposeIssueReasonEnumSchema {
	export type Type = z.infer<DeliveryPurposeIssueReasonEnumSchema>;
}
