import { z } from "zod";

import { AutonomousLineSchema } from "~/engine/line/schema/AutonomousLineSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { AutonomousLineIssueReasonEnumSchema } from "./AutonomousLineIssueReasonEnumSchema";

export const AutonomousLineIssueSchema = z
	.object({
		line: AutonomousLineSchema,
		reason: AutonomousLineIssueReasonEnumSchema,
		type: RuntimeCheckIssueEnumSchema.extract([
			"AutonomousLine",
		]),
	})
	.strict()
	.meta({
		id: "AutonomousLineIssueSchema",
		description: "One invalid save-backed autonomous line selection.",
	});

export type AutonomousLineIssueSchema = typeof AutonomousLineIssueSchema;

export namespace AutonomousLineIssueSchema {
	export type Type = z.infer<AutonomousLineIssueSchema>;
}
