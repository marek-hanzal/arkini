import { z } from "zod";

import { CraftJobOwnerQuantityIssueSchema } from "~/v1/job/schema/CraftJobOwnerQuantityIssueSchema";
import { DuplicateJobIdIssueSchema } from "~/v1/job/schema/DuplicateJobIdIssueSchema";
import { JobLineMissingIssueSchema } from "~/v1/job/schema/JobLineMissingIssueSchema";
import { JobOwnerMissingIssueSchema } from "~/v1/job/schema/JobOwnerMissingIssueSchema";
import { JobOwnerMultipleActiveIssueSchema } from "~/v1/job/schema/JobOwnerMultipleActiveIssueSchema";
import { JobOwnerNotOnGridIssueSchema } from "~/v1/job/schema/JobOwnerNotOnGridIssueSchema";
import { JobQueueExceededIssueSchema } from "~/v1/job/schema/JobQueueExceededIssueSchema";
import { JobReservationOrphanIssueSchema } from "~/v1/job/schema/JobReservationOrphanIssueSchema";
import { JobTimeInvalidIssueSchema } from "~/v1/job/schema/JobTimeInvalidIssueSchema";
import { InputCapacityExceededIssueSchema } from "~/v1/input/schema/check/InputCapacityExceededIssueSchema";
import { InputLineMissingIssueSchema } from "~/v1/input/schema/check/InputLineMissingIssueSchema";
import { InputOwnerMissingIssueSchema } from "~/v1/input/schema/check/InputOwnerMissingIssueSchema";
import { InputSelectorMismatchIssueSchema } from "~/v1/input/schema/check/InputSelectorMismatchIssueSchema";
import { InputSlotInvalidIssueSchema } from "~/v1/input/schema/check/InputSlotInvalidIssueSchema";
import { DuplicateItemIdIssueSchema } from "./DuplicateItemIdIssueSchema";
import { ItemMaxCountIssueSchema } from "./ItemMaxCountIssueSchema";
import { ItemStackSizeIssueSchema } from "./ItemStackSizeIssueSchema";
import { LocationOccupiedIssueSchema } from "./LocationOccupiedIssueSchema";
import { LocationOutOfBoundsIssueSchema } from "./LocationOutOfBoundsIssueSchema";
import { LineInputClosedIssueSchema } from "~/v1/line/schema/check/LineInputClosedIssueSchema";
import { LocationScopeIssueSchema } from "./LocationScopeIssueSchema";

/**
 * One explicitly reported runtime invariant violation.
 */
export const RuntimeCheckIssueSchema = z
	.discriminatedUnion("type", [
		CraftJobOwnerQuantityIssueSchema,
		DuplicateJobIdIssueSchema,
		JobOwnerMissingIssueSchema,
		JobOwnerMultipleActiveIssueSchema,
		JobOwnerNotOnGridIssueSchema,
		JobLineMissingIssueSchema,
		JobQueueExceededIssueSchema,
		JobTimeInvalidIssueSchema,
		JobReservationOrphanIssueSchema,
		DuplicateItemIdIssueSchema,
		ItemMaxCountIssueSchema,
		ItemStackSizeIssueSchema,
		InputOwnerMissingIssueSchema,
		InputLineMissingIssueSchema,
		InputSlotInvalidIssueSchema,
		InputSelectorMismatchIssueSchema,
		InputCapacityExceededIssueSchema,
		LineInputClosedIssueSchema,
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
