import { z } from "zod";

import { DuplicateItemIdIssueSchema } from "./DuplicateItemIdIssueSchema";
import { LocationOccupiedIssueSchema } from "./LocationOccupiedIssueSchema";
import { LocationOutOfBoundsIssueSchema } from "./LocationOutOfBoundsIssueSchema";
import { LocationScopeIssueSchema } from "./LocationScopeIssueSchema";

/**
 * One explicitly reported runtime invariant violation.
 */
export const RuntimeCheckIssueSchema = z
	.discriminatedUnion("type", [
		DuplicateItemIdIssueSchema,
		LocationOccupiedIssueSchema,
		LocationOutOfBoundsIssueSchema,
		LocationScopeIssueSchema,
	])
	.meta({
		id: "RuntimeCheckIssueSchema",
		description: "One explicitly reported runtime invariant violation.",
	});

export type RuntimeCheckIssueSchema = typeof RuntimeCheckIssueSchema;

export namespace RuntimeCheckIssueSchema {
	export type Type = z.infer<RuntimeCheckIssueSchema>;
}
