import { z } from "zod";

/** The finite reasons why one canonical outbound delivery target is invalid. */
export const DeliveryTargetIssueReasonEnumSchema = z.enum({
	ClaimsExceedTarget: "claims-exceed-target",
	LineMissing: "line-missing",
	OwnerMissing: "owner-missing",
	OwnerNotOnBoard: "owner-not-on-board",
	SelectorMismatch: "selector-mismatch",
	SlotClosed: "slot-closed",
	SlotInvalid: "slot-invalid",
});

export type DeliveryTargetIssueReasonEnumSchema = typeof DeliveryTargetIssueReasonEnumSchema;

export namespace DeliveryTargetIssueReasonEnumSchema {
	export type Type = z.infer<DeliveryTargetIssueReasonEnumSchema>;
}
