import { z } from "zod";

export const AutonomousLineIssueReasonEnumSchema = z.enum({
	DuplicateSelection: "duplicate-selection",
	LineMissing: "line-missing",
	NotSupported: "not-supported",
	OwnerMissing: "owner-missing",
	OwnerNotOnBoard: "owner-not-on-board",
});

export type AutonomousLineIssueReasonEnumSchema = typeof AutonomousLineIssueReasonEnumSchema;

export namespace AutonomousLineIssueReasonEnumSchema {
	export type Type = z.infer<AutonomousLineIssueReasonEnumSchema>;
}
