import { z } from "zod";

import { RuntimeCheckIssueSchema } from "./RuntimeCheckIssueSchema";

/**
 * Every invariant violation found in one runtime snapshot.
 */
export const RuntimeCheckResultSchema = z
	.object({
		issues: z
			.array(RuntimeCheckIssueSchema)
			.describe("Every invariant violation found in the runtime snapshot."),
	})
	.strict()
	.meta({
		id: "RuntimeCheckResultSchema",
		description: "Every invariant violation found in one runtime snapshot.",
	});

export type RuntimeCheckResultSchema = typeof RuntimeCheckResultSchema;

export namespace RuntimeCheckResultSchema {
	export type Type = z.infer<RuntimeCheckResultSchema>;
}
